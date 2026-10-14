# PROJECT OMEGA — Mobile Online Prototype 0.2

**Goal:** a small browser-playable 3D arena prototype for iPad/mobile. This is not the complete battle-royale game and is not production-ready.

## Included in this package
- Three.js 3D greybox arena with cover blocks.
- Touch movement joystick, drag-to-aim, FIRE button, health/score/player-count HUD.
- Node.js WebSocket server for one shared room (up to 12 connections).
- Server-stepped movement and basic server-side shot cooldown/damage/respawn.
- Health endpoint at `/health`.
- `render.yaml` deployment blueprint for a Node web service.

## Publish it from an iPad (requires your own hosting account)

1. Extract the ZIP in the iPad Files app.
2. Create a GitHub repository named `project-omega-mobile-online`.
3. Upload the **contents** of the `ProjectOmega_MobileOnline` folder, keeping the folder structure. Do not combine all source files into one text file.
4. In your hosting provider, create a new web service from that GitHub repository. A provider that supports Node.js and WebSockets is required.
5. Settings for a manual service, if requested:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
6. Deploy. Open the HTTPS URL given by the hosting provider in Safari. The page and WebSocket endpoint use the same origin.
7. Open that URL on two devices (or separate browser sessions) and verify that the player count changes and players can move/shoot. If the host's free plan sleeps or limits connections, check its current policy.

**Important:** GitHub stores the source code; it does not run the multiplayer server. I cannot publish it into your hosting account or generate a real public game URL without that account's deployment action.

## Run locally (computer required)
Requires Node.js 20+.

```bash
npm install
npm run check
npm start
```

Open `http://localhost:3000`.

## Honest test report
- **Ran here:** `node --check public/game.js`; `node --check server/index.js` (syntax checks only).
- **Not run here:** dependency installation, server startup, browser rendering, iPad Safari, two-device networking, deployment, load/security testing.
- Therefore this prototype is **not verified playable online yet** and its T0 multiplayer vertical-slice gate remains **FAIL / NOT RUN**.

## Not implemented
Accounts/login, database/persistence, robust matchmaking, regional dedicated servers, production anti-cheat, battle-royale zone/loot/vehicles, finished 3D characters/animations/audio, chat/voice, monetization, moderation, monitoring, CI/CD.

## Architecture boundary
This is a browser/WebSocket prototype, not the final Unity + authoritative dedicated game-server architecture from the PROJECT OMEGA master specification. Treat it as an early test build only. Before competitive play, add authentication, robust server-side collision/obstacle validation, rate limiting, anti-cheat review, persistence, room isolation, monitoring, automated tests, and target-device performance testing.
