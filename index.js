import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/play' });
const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 12;
const TICK_MS = 50;
const SPEED = 5.0;
const ARENA = 44;
const SHOT_COOLDOWN_MS = 350;
const HIT_RANGE = 18;
const HIT_CONE_DOT = Math.cos(0.105);
const players = new Map();

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true, service: 'project-omega-room', players: players.size, maxPlayers: MAX_PLAYERS }));
app.use(express.static(path.join(root, 'public')));
app.get(/.*/, (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

function send(ws, data) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data)); }
function broadcast(data) {
  const packet = JSON.stringify(data);
  for (const p of players.values()) if (p.ws.readyState === p.ws.OPEN) p.ws.send(packet);
}
function publicPlayer(p) { return { id: p.id, name: p.name, x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, score: p.score, color: p.color }; }
function safeNumber(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
function normalize(x, z) { const len = Math.hypot(x, z); return len > 1 ? [x / len, z / len] : [x, z]; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) { send(ws, { type: 'error', message: 'Room full. Try again in a moment.' }); ws.close(1013, 'Room full'); return; }
  const id = randomUUID();
  const hue = Math.floor(Math.random() * 360);
  const p = { id, ws, name: `Omega-${id.slice(0, 4).toUpperCase()}`, x: (Math.random() - 0.5) * 24, z: (Math.random() - 0.5) * 24, yaw: 0, moveX: 0, moveZ: 0, hp: 100, score: 0, color: `hsl(${hue} 75% 58%)`, lastShot: 0, lastInput: Date.now(), respawnAt: 0 };
  players.set(id, p);
  send(ws, { type: 'welcome', id, name: p.name, maxPlayers: MAX_PLAYERS, tickRate: 1000 / TICK_MS, rules: { speed: SPEED, arena: ARENA } });
  broadcast({ type: 'notice', text: `${p.name} joined the arena` });

  ws.on('message', (raw) => {
    if (raw.length > 2048) return;
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'input') {
      const mx = clamp(safeNumber(msg.moveX), -1, 1);
      const mz = clamp(safeNumber(msg.moveZ), -1, 1);
      [p.moveX, p.moveZ] = normalize(mx, mz);
      p.yaw = clamp(safeNumber(msg.yaw, p.yaw), -Math.PI * 100, Math.PI * 100);
      p.lastInput = Date.now();
      if (msg.shoot === true) shoot(p);
    } else if (msg.type === 'rename' && typeof msg.name === 'string') {
      const name = msg.name.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16);
      if (name.length >= 3) p.name = name;
    }
  });
  ws.on('close', () => { players.delete(id); broadcast({ type: 'notice', text: `${p.name} left the arena` }); });
  ws.on('error', () => {});
});

function shoot(shooter) {
  const now = Date.now();
  if (now - shooter.lastShot < SHOT_COOLDOWN_MS || shooter.hp <= 0) return;
  shooter.lastShot = now;
  const dx = Math.sin(shooter.yaw), dz = Math.cos(shooter.yaw);
  let best = null, bestDist = HIT_RANGE;
  for (const target of players.values()) {
    if (target.id === shooter.id || target.hp <= 0) continue;
    const vx = target.x - shooter.x, vz = target.z - shooter.z;
    const dist = Math.hypot(vx, vz);
    if (dist > HIT_RANGE || dist < 0.01) continue;
    const dot = (vx / dist) * dx + (vz / dist) * dz;
    if (dot > HIT_CONE_DOT && dist < bestDist) { best = target; bestDist = dist; }
  }
  broadcast({ type: 'shot', id: shooter.id, x: shooter.x, z: shooter.z, yaw: shooter.yaw, hitId: best?.id ?? null });
  if (best) {
    best.hp = Math.max(0, best.hp - 34);
    broadcast({ type: 'hit', shooterId: shooter.id, targetId: best.id, hp: best.hp });
    if (best.hp <= 0) {
      shooter.score += 1;
      best.respawnAt = now + 2200;
      broadcast({ type: 'elimination', killerId: shooter.id, targetId: best.id, killerScore: shooter.score });
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (now - p.lastInput > 2500) { p.moveX = 0; p.moveZ = 0; }
    if (p.hp <= 0 && p.respawnAt && now >= p.respawnAt) {
      p.x = (Math.random() - 0.5) * 26; p.z = (Math.random() - 0.5) * 26; p.hp = 100; p.respawnAt = 0;
      send(p.ws, { type: 'respawn' });
    }
    if (p.hp > 0) {
      p.x = clamp(p.x + p.moveX * SPEED * TICK_MS / 1000, -ARENA / 2, ARENA / 2);
      p.z = clamp(p.z + p.moveZ * SPEED * TICK_MS / 1000, -ARENA / 2, ARENA / 2);
    }
  }
  broadcast({ type: 'state', serverTime: now, players: [...players.values()].map(publicPlayer) });
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => console.log(`PROJECT OMEGA mobile server listening on ${PORT}`));
