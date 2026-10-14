import * as THREE from 'three';

const host = document.getElementById('game');
const connectionEl = document.getElementById('connection');
const noticeEl = document.getElementById('notice');
const playerTag = document.getElementById('playerTag');
const populationEl = document.getElementById('population');
const scoreEl = document.getElementById('score');
const healthFill = document.getElementById('healthFill');
const healthText = document.getElementById('healthText');
const startPanel = document.getElementById('startPanel');
const joinButton = document.getElementById('join');
const nicknameInput = document.getElementById('nickname');
const stickZone = document.getElementById('stickZone');
const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');
const fireButton = document.getElementById('fire');
const recenterButton = document.getElementById('recenter');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fc5d1');
scene.fog = new THREE.Fog('#9fc5d1', 35, 85);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 150);
camera.position.set(0, 11, 15);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe1f8ff, 0x344354, 2.0));
const sun = new THREE.DirectionalLight(0xfff0d9, 2.1); sun.position.set(-12, 22, 8); scene.add(sun);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshStandardMaterial({ color: '#334d50', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; scene.add(floor);
const grid = new THREE.GridHelper(44, 22, '#72c9cb', '#527276'); grid.position.y = 0.005; scene.add(grid);
const boundaryMat = new THREE.MeshStandardMaterial({ color: '#24404a', roughness: .9 });
for (const [x,z,sx,sz] of [[0,-22,44,.4],[0,22,44,.4],[-22,0,.4,44],[22,0,.4,44]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(sx,1.6,sz),boundaryMat); wall.position.set(x,.8,z); scene.add(wall); }
const coverMat = new THREE.MeshStandardMaterial({ color: '#718b85', roughness: .9 });
for (const [x,z,sx,sz] of [[-8,-5,3,2],[7,-8,2,4],[2,5,4,2],[-12,7,2,4],[12,10,3,2],[0,-13,5,2],[-2,12,2,3],[14,-2,2,3]]) { const box = new THREE.Mesh(new THREE.BoxGeometry(sx,1.3,sz),coverMat); box.position.set(x,.65,z); scene.add(box); }

const players = new Map();
const tracerGroup = new THREE.Group(); scene.add(tracerGroup);
const me = { id: null, yaw: 0, moveX: 0, moveZ: 0, shooting: false, hp: 100, score: 0 };
let socket = null, joined = false, lastSend = 0, noticeTimer = 0, pointerLookId = null, lookX = 0, stickPointer = null, stickOrigin = {x:0,y:0};
const matFor = (color) => new THREE.MeshStandardMaterial({ color: color || '#5ae4f2', roughness: .6 });
function makeAvatar(p) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.38,.65,3,6), matFor(p.color)); body.position.y = .78; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.25,8,6), new THREE.MeshStandardMaterial({color:'#e4c2a1',roughness:.8})); head.position.set(0,1.42,0); root.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.8), new THREE.MeshStandardMaterial({color:'#17232c',metalness:.4,roughness:.55})); gun.position.set(.24,1.02,.45); root.add(gun);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.53,.035,4,12), new THREE.MeshBasicMaterial({color:p.color || '#5ae4f2'})); ring.rotation.x = Math.PI/2; ring.position.y = .08; root.add(ring);
  root.userData.body = body; root.userData.ring = ring; scene.add(root); return root;
}
function notice(text) { noticeEl.textContent = text; noticeEl.style.display = 'block'; clearTimeout(noticeTimer); noticeTimer = setTimeout(()=>{ if(joined) noticeEl.style.display='none'; }, 2600); }
function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/play`);
  connectionEl.textContent = 'CONNECTING…'; connectionEl.classList.remove('live');
  socket.addEventListener('open', () => { connectionEl.textContent='ONLINE'; connectionEl.classList.add('live'); joined=true; socket.send(JSON.stringify({type:'rename',name:nicknameInput.value || 'OmegaRookie'})); startPanel.classList.add('hidden'); notice('Connected. Find another player and tap FIRE.'); });
  socket.addEventListener('message', (event) => { let msg; try { msg=JSON.parse(event.data); } catch { return; } handleMessage(msg); });
  socket.addEventListener('close', () => { connectionEl.textContent='OFFLINE'; connectionEl.classList.remove('live'); joined=false; startPanel.classList.remove('hidden'); notice('Disconnected. Check the server and rejoin.'); });
  socket.addEventListener('error', () => notice('Connection error. The online server may not be deployed yet.'));
}
function handleMessage(msg) {
  if(msg.type==='welcome'){me.id=msg.id;playerTag.textContent=`YOU · ${msg.name}`;notice(`Room ready · server tick ${msg.tickRate} Hz`);}
  if(msg.type==='state'){
    populationEl.textContent=`${msg.players.length} / 12 PLAYERS`;
    const active = new Set();
    for(const p of msg.players){active.add(p.id);let item=players.get(p.id);if(!item){item={mesh:makeAvatar(p),data:p};players.set(p.id,item);}item.data=p;item.mesh.position.set(p.x,0,p.z);item.mesh.rotation.y=p.yaw;item.mesh.visible=p.hp>0;item.mesh.userData.body.material.color.set(p.color);if(p.id===me.id){me.hp=p.hp;me.score=p.score;healthFill.style.width=`${p.hp}%`;healthText.textContent=p.hp;scoreEl.textContent=`ELIMS ${p.score}`;}}
    for(const [id,item] of players){if(!active.has(id)){scene.remove(item.mesh);players.delete(id);}}
  }
  if(msg.type==='notice')notice(msg.text);
  if(msg.type==='shot')makeTracer(msg.x,msg.z,msg.yaw,msg.hitId);
  if(msg.type==='elimination')notice(msg.killerId===me.id?'ELIMINATION CONFIRMED':msg.targetId===me.id?'YOU WERE TAGGED — RESPAWNING':'PLAYER ELIMINATED');
  if(msg.type==='error')notice(msg.message);
  if(msg.type==='respawn')notice('Respawned. Back in the arena.');
}
function makeTracer(x,z,yaw,hitId){const start=new THREE.Vector3(x,.95,z);const end=new THREE.Vector3(x+Math.sin(yaw)*12,.95,z+Math.cos(yaw)*12);const geo=new THREE.BufferGeometry().setFromPoints([start,end]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:hitId?'#ffb15a':'#c9faff',transparent:true,opacity:.85}));tracerGroup.add(line);setTimeout(()=>{tracerGroup.remove(line);geo.dispose();line.material.dispose();},110);}
function sendInput(){if(!socket||socket.readyState!==WebSocket.OPEN)return;const now=performance.now();if(now-lastSend<45)return;lastSend=now;socket.send(JSON.stringify({type:'input',moveX:me.moveX,moveZ:me.moveZ,yaw:me.yaw,shoot:me.shooting}));}
function updateCamera(){const p=players.get(me.id);if(!p)return;const target=p.mesh.position;const behind=new THREE.Vector3(-Math.sin(me.yaw)*7,5.6,-Math.cos(me.yaw)*7);const desired=new THREE.Vector3(target.x+behind.x,target.y+behind.y,target.z+behind.z);camera.position.lerp(desired,.12);camera.lookAt(target.x,target.y+1.0,target.z);}
function animate(){requestAnimationFrame(animate);sendInput();updateCamera();renderer.render(scene,camera);}animate();

joinButton.addEventListener('click',()=>{if(!nicknameInput.value.trim()||nicknameInput.value.trim().length<3){notice('Callsign must be at least 3 characters.');return;}connect();});
fireButton.addEventListener('pointerdown',(e)=>{e.preventDefault();me.shooting=true;fireButton.setPointerCapture?.(e.pointerId);});
for(const ev of ['pointerup','pointercancel','pointerleave'])fireButton.addEventListener(ev,()=>{me.shooting=false;});
recenterButton.addEventListener('click',()=>{me.yaw=0;notice('Aim direction reset.');});

stickZone.addEventListener('pointerdown',(e)=>{if(e.clientX>innerWidth*.48)return;stickPointer=e.pointerId;stickZone.setPointerCapture(e.pointerId);stickOrigin={x:e.clientX,y:e.clientY};stickBase.style.display='block';stickBase.style.left=`${e.clientX}px`;stickBase.style.top=`${e.clientY}px`;moveStick(e);});
stickZone.addEventListener('pointermove',(e)=>{if(e.pointerId===stickPointer)moveStick(e);});
function moveStick(e){const dx=e.clientX-stickOrigin.x,dy=e.clientY-stickOrigin.y,len=Math.hypot(dx,dy),scale=len>38?38/len:1;stickKnob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;me.moveX=clamp(dx/38,-1,1);me.moveZ=clamp(dy/38,-1,1);}
function endStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;me.moveX=0;me.moveZ=0;stickBase.style.display='none';stickKnob.style.transform='translate(0,0)';}
stickZone.addEventListener('pointerup',endStick);stickZone.addEventListener('pointercancel',endStick);
// Drag the right half to rotate aim; do not intercept fire/control buttons.
renderer.domElement.addEventListener('pointerdown',(e)=>{if(e.clientX<innerWidth*.48)return;pointerLookId=e.pointerId;lookX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',(e)=>{if(e.pointerId!==pointerLookId)return;const dx=e.clientX-lookX;lookX=e.clientX;me.yaw+=dx*.009;});
function endLook(e){if(e.pointerId===pointerLookId)pointerLookId=null;}renderer.domElement.addEventListener('pointerup',endLook);renderer.domElement.addEventListener('pointercancel',endLook);
window.addEventListener('keydown',(e)=>{if(e.key==='a'||e.key==='ArrowLeft')me.moveX=-1;if(e.key==='d'||e.key==='ArrowRight')me.moveX=1;if(e.key==='w'||e.key==='ArrowUp')me.moveZ=-1;if(e.key==='s'||e.key==='ArrowDown')me.moveZ=1;if(e.key===' ')me.shooting=true;});
window.addEventListener('keyup',(e)=>{if(['a','d','ArrowLeft','ArrowRight'].includes(e.key))me.moveX=0;if(['w','s','ArrowUp','ArrowDown'].includes(e.key))me.moveZ=0;if(e.key===' ')me.shooting=false;});
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));});
