# BoxHead Multiplayer Design

**Date:** 2026-04-30  
**Scope:** Local-network multiplayer for up to 4 players — Co-op and PvP modes alongside existing Solo play.

---

## 1. Game Flow

```
Menu → Mode Select → [Solo]  → Map Select → Game (unchanged)
                  → [Co-op] → Name Entry → Host or Join?
                  → [PvP]       Host: display IP, open lobby
                                Join: enter host IP, connect to lobby
                                    → Lobby (player list, host picks map & starts)
                                        → Game
```

### Mode Rules

| Mode  | Friendly fire | Game over condition         |
|-------|---------------|-----------------------------|
| Solo  | n/a           | Local player dies           |
| Co-op | Off           | All players dead            |
| PvP   | On            | Last player standing wins   |

In both Co-op and PvP, enemies spawn and wave progression continues normally.

### Death in Multiplayer

Dead players enter **spectator mode** — they cannot move or shoot but remain in the session. A spectator UI lets them cycle through alive players' cameras. When all players are dead (Co-op) or only one remains (PvP), the run ends.

---

## 2. Network Architecture

### Setup

`npm run host` starts two processes via `concurrently`:
1. **Vite dev server** on port `5173` — serves the game to all browsers on the LAN
2. **WebSocket relay server** on port `3001` — routes messages between clients

The host shares their local IP (e.g. `192.168.1.5`). Other players open `http://192.168.1.5:5173` in their browser.

### Relay Server Responsibilities

The server is intentionally stateless with respect to game logic. It only:
- Accepts connections and assigns player IDs (1–4)
- Tracks lobby state (names, ready status)
- Relays `input` messages from non-host clients to the host client
- Relays `state` snapshots from the host client to all non-host clients
- Broadcasts `lobby_update` on join/leave
- Enforces 4-player maximum

The server never touches positions, HP, physics, or AI.

### Host Disconnect

If the host's WebSocket connection drops, the server broadcasts `{ type: "host_left" }` to all remaining clients. Each client shows a "Host disconnected — returning to menu" message and navigates back to ModeScene after 3 seconds. There is no host migration.

### Host Client (Authoritative)

The host's browser runs the full Phaser simulation for **all** players:
- Applies local input for P1 each frame
- Applies relayed inputs for P2–P4 each frame
- Broadcasts a compressed state snapshot to the server at **20 Hz**
- The server fans the snapshot out to all non-host clients

### Non-Host Clients

- Send a compact input message to the server every frame
- Receive state snapshots and apply them to local sprites (no physics simulation)
- Render enemies, pickups, and other players from received state
- Feel near-instant on LAN (< 5 ms latency — no prediction needed)

---

## 3. Message Protocol

All messages are JSON strings over WebSocket.

### Client → Server

```jsonc
{ "type": "join",       "name": "Alice" }
{ "type": "input",      "keys": { "up": true, "down": false, "left": false, "right": true },
                         "aimAngle": 1.57, "shooting": true }
{ "type": "start_game", "roomKey": "crossfire", "mode": "coop" }
```

### Server → Client

```jsonc
{ "type": "assigned",     "playerId": 1, "isHost": true }
{ "type": "lobby_update", "players": [{ "id": 1, "name": "Alice", "isHost": true },
                                       { "id": 2, "name": "Bob",   "isHost": false }] }
{ "type": "input_relay",  "playerId": 2, "keys": { ... }, "aimAngle": 0.0, "shooting": false }
{ "type": "game_start",   "roomKey": "crossfire", "mode": "coop", "seed": 1735294827 }
{ "type": "state",        ...snapshot... }
{ "type": "player_left",  "playerId": 2 }
```

### State Snapshot (20 Hz, host → server → all clients)

```jsonc
{
  "wave": 3,
  "players": [
    { "id": 1, "x": 240, "y": 310, "hp": 80, "aimAngle": 0.5,
      "weaponKey": "shotgun", "score": 1400, "dead": false }
  ],
  "enemies": [
    { "id": 7, "x": 500, "y": 200, "hp": 12, "kind": "brute" }
  ],
  "boss": { "x": 480, "y": 300, "hp": 210, "maxHp": 340 },
  "pickups": [
    { "id": 3, "x": 160, "y": 420, "kind": "ammo" }
  ]
}
```

The `seed` in `game_start` synchronises `Math.random` so visual-only effects (decals, muzzle flash positions) look consistent across clients. All authoritative state comes from the host's snapshot.

---

## 4. New Files & Modified Files

### New Files

| Path | Purpose |
|------|---------|
| `server.js` | Node.js WebSocket relay server (~120 lines) |
| `src/game/scenes/ModeScene.ts` | Solo / Co-op / PvP selection screen |
| `src/game/scenes/LobbyScene.ts` | Name entry, Host/Join UI, player list, start |
| `src/game/net/NetworkManager.ts` | WebSocket client wrapper + message queue |
| `src/game/net/types.ts` | Shared message and snapshot TypeScript types |

### Modified Files

| Path | Change |
|------|--------|
| `package.json` | Add `ws`, `concurrently`; add `"host"` script |
| `src/main.ts` | Register ModeScene and LobbyScene in Phaser config |
| `src/game/scenes/MenuScene.ts` | "Play" navigates to ModeScene instead of map select |
| `src/game/scenes/GameScene.ts` | Full multiplayer support (see below) |

---

## 5. GameScene Multiplayer Changes

### Player Management

Replace the single `player` sprite with:

```typescript
private players = new Map<number, PlayerSprite>();
private localPlayerId = 1;
```

One `PlayerSprite` entry per connected player, keyed by player ID. `localPlayerId` identifies which sprite this client controls.

### Per-Frame Logic

**If host:**
1. Read local keyboard/mouse input → apply to P1 sprite
2. Drain `NetworkManager` input queue → apply relayed inputs to P2–P4 sprites
3. Run normal Phaser physics simulation (all players, enemies, bullets)
4. Every 50 ms (20 Hz): serialise state snapshot → send via `NetworkManager`

**If non-host client:**
1. Read local keyboard/mouse input → send via `NetworkManager`
2. Apply latest received state snapshot to all sprites (set position, HP, etc.)
3. Skip physics simulation for enemies and remote players (positions come from snapshot)

### Friendly Fire

- **Co-op:** no overlap registered between `bullets` group and remote player sprites
- **PvP:** overlap registered between `bullets` group and all player sprites (including local)

### Spectator Mode

When a player's HP reaches 0:
- Their sprite fades and stops accepting input
- Spectator bar appears at screen bottom (see Section 6)
- Camera follows the first alive player by default

---

## 6. Player Visuals & Spectator UI

### Player Colors (tint applied to sprite)

| Slot | Color   | Hex        |
|------|---------|------------|
| P1   | White   | no tint    |
| P2   | Blue    | `0x6ab0ff` |
| P3   | Green   | `0x6dff8a` |
| P4   | Yellow  | `0xffd76a` |

A name label (`Phaser.GameObjects.Text`) floats 20px above each player sprite and updates every frame to follow the sprite.

### Spectator UI

Shown only when the local player is dead:

```
[ Spectating: Alice   ◀  ▶ ]
```

- Rendered as a DOM overlay (like the existing HUD)
- `◀` / `▶` buttons (or keyboard `,` / `.`) cycle through alive players
- Camera smoothly follows the selected player via `camera.startFollow(sprite)`
- In PvP mode, a small leaderboard overlay shows remaining players ranked by score

### Lobby Screen

1. Text input: player name
2. Buttons: **Host Game** / **Join Game**
3. If joining: IP address text input appears
4. Once in lobby: player list with name, color swatch, "HOST" badge
5. Host sees: map dropdown + **Start Game** button
6. Non-hosts see: "Waiting for host to start…"

---

## 7. npm Scripts

```jsonc
"scripts": {
  "dev":   "vite --host 0.0.0.0",
  "host":  "concurrently \"node server.js\" \"vite --host 0.0.0.0\"",
  "build": "tsc && vite build",
  "test":  "vitest run"
}
```

`--host 0.0.0.0` makes Vite accessible on the local network (not just `127.0.0.1`).

---

## 8. Dependencies to Add

| Package | Purpose |
|---------|---------|
| `ws` | WebSocket server in Node.js |
| `concurrently` | Run Vite + server in one terminal command |
| `@types/ws` | TypeScript types for `ws` (devDependency) |
