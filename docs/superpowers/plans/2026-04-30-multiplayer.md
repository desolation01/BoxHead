# BoxHead Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-network Co-op and PvP multiplayer (up to 4 players) via a lightweight WebSocket relay server, with Solo mode unchanged.

**Architecture:** One player runs `npm run host` which starts a Vite dev server and a Node.js WebSocket relay on port 3001. The host's browser runs the authoritative Phaser simulation; non-host clients send inputs and render state snapshots received at 20 Hz. GameScene is extended to manage multiple player sprites with the host simulating all of them.

**Tech Stack:** Phaser 3, TypeScript, Vite, `ws` (Node.js WebSocket server), `concurrently`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server.js` | WS relay: assign IDs, relay inputs/state, lobby broadcast |
| Create | `src/game/net/types.ts` | All network message + snapshot types |
| Create | `src/game/net/NetworkManager.ts` | WS client wrapper, input queue, singleton `network` |
| Create | `src/game/scenes/ModeScene.ts` | Solo / Co-op / PvP mode selection |
| Create | `src/game/scenes/LobbyScene.ts` | Name entry, Host/Join UI, player list, start |
| Modify | `package.json` | Add `ws`, `concurrently`, `@types/ws`; add `host` script |
| Modify | `src/main.ts` | Register ModeScene, LobbyScene |
| Modify | `src/styles.css` | Lobby input, player swatch, spectator bar styles |
| Modify | `src/game/scenes/MenuScene.ts` | "Play" → ModeScene |
| Modify | `src/game/scenes/GameScene.ts` | Multi-player sprites, host sim, client snapshot, spectator |

---

## Task 1: Install Dependencies & Update Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "c:\Users\ediwo\OneDrive\Desktop\Cursor\Games\BoxHead"
npm install ws concurrently
npm install --save-dev @types/ws
```

- [ ] **Step 2: Update package.json scripts and change dev host**

Open `package.json`. Replace the `scripts` block with:

```json
"scripts": {
  "dev":   "vite --host 0.0.0.0",
  "host":  "concurrently \"node server.js\" \"vite --host 0.0.0.0\"",
  "build": "tsc && vite build",
  "test":  "vitest run"
}
```

- [ ] **Step 3: Verify install**

```bash
npm run test
```

Expected: all existing tests pass (no failures).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add ws, concurrently; add host script"
```

---

## Task 2: Network Types

**Files:**
- Create: `src/game/net/types.ts`
- Create: `src/game/__tests__/network-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/__tests__/network-types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { StateSnapshot, PlayerState } from "../net/types";

describe("StateSnapshot shape", () => {
  it("accepts a valid snapshot", () => {
    const snapshot: StateSnapshot = {
      wave: 3,
      players: [{ id: 1, x: 100, y: 200, hp: 80, aimAngle: 0, weaponKey: "pistol", score: 400, dead: false, facingLeft: false }],
      enemies: [{ id: 7, x: 500, y: 300, hp: 10, kind: "shambler" }],
      boss: null,
      pickups: []
    };
    const player: PlayerState = snapshot.players[0]!;
    expect(player.id).toBe(1);
    expect(player.dead).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- network-types
```

Expected: FAIL — `Cannot find module '../net/types'`

- [ ] **Step 3: Create `src/game/net/types.ts`**

```typescript
export type GameMode = "solo" | "coop" | "pvp";

export interface LobbyPlayer {
  id: number;
  name: string;
  isHost: boolean;
}

export interface InputKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface PlayerState {
  id: number;
  x: number;
  y: number;
  hp: number;
  aimAngle: number;
  weaponKey: string;
  score: number;
  dead: boolean;
  facingLeft: boolean;
}

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  hp: number;
  kind: string;
}

export interface BossState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  kind: string;
}

export interface StateSnapshot {
  wave: number;
  players: PlayerState[];
  enemies: EnemyState[];
  boss: BossState | null;
  pickups: PickupState[];
}

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "input"; keys: InputKeys; aimAngle: number; shooting: boolean }
  | { type: "start_game"; roomKey: string; mode: GameMode }
  | { type: "state"; payload: StateSnapshot };

export type ServerMessage =
  | { type: "assigned"; playerId: number; isHost: boolean }
  | { type: "lobby_update"; players: LobbyPlayer[] }
  | { type: "input_relay"; playerId: number; keys: InputKeys; aimAngle: number; shooting: boolean }
  | { type: "game_start"; roomKey: string; mode: GameMode; seed: number; players: LobbyPlayer[] }
  | { type: "state"; players: PlayerState[]; enemies: EnemyState[]; boss: BossState | null; wave: number; pickups: PickupState[] }
  | { type: "player_left"; playerId: number }
  | { type: "host_left" }
  | { type: "error"; message: string };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- network-types
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/net/types.ts src/game/__tests__/network-types.test.ts
git commit -m "feat: add network message and snapshot types"
```

---

## Task 3: NetworkManager

**Files:**
- Create: `src/game/net/NetworkManager.ts`
- Create: `src/game/__tests__/network-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/game/__tests__/network-manager.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { NetworkManager } from "../net/NetworkManager";

describe("NetworkManager input queue", () => {
  it("keeps only latest input per player", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false });
    manager.enqueueInput({ playerId: 2, keys: { up: false, down: true, left: false, right: false }, aimAngle: 1.0, shooting: true });
    const drained = manager.drainInputs();
    expect(drained).toHaveLength(1);
    expect(drained[0]!.keys.down).toBe(true);
    expect(drained[0]!.aimAngle).toBe(1.0);
  });

  it("tracks multiple players independently", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false });
    manager.enqueueInput({ playerId: 3, keys: { up: false, down: true, left: false, right: false }, aimAngle: 0.5, shooting: false });
    expect(manager.drainInputs()).toHaveLength(2);
  });

  it("returns empty array after draining", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false });
    manager.drainInputs();
    expect(manager.drainInputs()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- network-manager
```

Expected: FAIL — `Cannot find module '../net/NetworkManager'`

- [ ] **Step 3: Create `src/game/net/NetworkManager.ts`**

```typescript
import type { ClientMessage, InputKeys, ServerMessage } from "./types";

type QueuedInput = { playerId: number; keys: InputKeys; aimAngle: number; shooting: boolean };

export class NetworkManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Array<(msg: ServerMessage) => void>>();
  private inputQueue: QueuedInput[] = [];

  connect(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${host}:3001`);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("Connection failed"));
      this.ws.onmessage = (event) => {
        let msg: ServerMessage;
        try { msg = JSON.parse(event.data as string); } catch { return; }
        for (const handler of this.handlers.get(msg.type) ?? []) handler(msg);
      };
      this.ws.onclose = () => {
        for (const handler of this.handlers.get("host_left") ?? []) {
          handler({ type: "host_left" } as ServerMessage);
        }
      };
    });
  }

  on<T extends ServerMessage["type"]>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void
  ): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as (msg: ServerMessage) => void);
    this.handlers.set(type, list);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  enqueueInput(input: QueuedInput): void {
    const idx = this.inputQueue.findIndex((i) => i.playerId === input.playerId);
    if (idx >= 0) this.inputQueue[idx] = input;
    else this.inputQueue.push(input);
  }

  drainInputs(): QueuedInput[] {
    const queue = [...this.inputQueue];
    this.inputQueue = [];
    return queue;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.inputQueue = [];
    this.handlers.clear();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const network = new NetworkManager();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- network-manager
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/net/NetworkManager.ts src/game/__tests__/network-manager.test.ts
git commit -m "feat: add NetworkManager with input queue"
```

---

## Task 4: WebSocket Relay Server

**Files:**
- Create: `server.js`

- [ ] **Step 1: Create `server.js` in the project root**

```javascript
import { WebSocketServer } from "ws";

const PORT = 3001;
const MAX_PLAYERS = 4;

const wss = new WebSocketServer({ port: PORT });

// playerId → WebSocket
const clients = new Map();
let nextId = 1;
let hostId = null;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients.values()) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function broadcastExcept(excludeId, msg) {
  const data = JSON.stringify(msg);
  for (const [id, ws] of clients.entries()) {
    if (id !== excludeId && ws.readyState === 1) ws.send(data);
  }
}

function getLobbyPlayers() {
  return [...clients.entries()].map(([id, ws]) => ({
    id,
    name: ws.playerName ?? "Player",
    isHost: id === hostId,
  }));
}

wss.on("connection", (ws) => {
  if (clients.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: "error", message: "Server full (max 4 players)" }));
    ws.close();
    return;
  }

  const playerId = nextId++;
  ws.playerId = playerId;
  ws.playerName = "Player";
  clients.set(playerId, ws);

  const isHost = clients.size === 1;
  if (isHost) hostId = playerId;

  ws.send(JSON.stringify({ type: "assigned", playerId, isHost }));
  broadcast({ type: "lobby_update", players: getLobbyPlayers() });

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case "join":
        ws.playerName = String(msg.name ?? "Player").slice(0, 20);
        broadcast({ type: "lobby_update", players: getLobbyPlayers() });
        break;

      case "input":
        if (playerId !== hostId && hostId !== null) {
          const hostWs = clients.get(hostId);
          if (hostWs?.readyState === 1) {
            hostWs.send(JSON.stringify({
              type: "input_relay",
              playerId,
              keys: msg.keys,
              aimAngle: msg.aimAngle,
              shooting: msg.shooting,
            }));
          }
        }
        break;

      case "start_game":
        if (playerId === hostId) {
          broadcast({
            type: "game_start",
            roomKey: msg.roomKey,
            mode: msg.mode,
            seed: Math.floor(Math.random() * 2 ** 31),
            players: getLobbyPlayers(),
          });
        }
        break;

      case "state":
        if (playerId === hostId) {
          broadcastExcept(hostId, { type: "state", ...msg.payload });
        }
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(playerId);
    if (playerId === hostId) {
      hostId = null;
      broadcast({ type: "host_left" });
      clients.clear();
      nextId = 1;
    } else {
      broadcast({ type: "player_left", playerId });
      broadcast({ type: "lobby_update", players: getLobbyPlayers() });
    }
  });
});

console.log(`BoxHead relay server running on ws://localhost:${PORT}`);
```

- [ ] **Step 2: Test the server starts**

```bash
node server.js
```

Expected output: `BoxHead relay server running on ws://localhost:3001`

Press Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add WebSocket relay server"
```

---

## Task 5: ModeScene

**Files:**
- Create: `src/game/scenes/ModeScene.ts`

- [ ] **Step 1: Create `src/game/scenes/ModeScene.ts`**

```typescript
import Phaser from "phaser";

export class ModeScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;

  constructor() {
    super("ModeScene");
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Select Mode</h1>
        <p class="menu__copy">Solo: classic single-player. Co-op: fight together, friendly fire off. PvP: fight everyone, friendly fire on.</p>
        <button class="menu__action" data-mode="solo">Solo</button>
        <button class="menu__action" data-mode="coop">Co-op (LAN, up to 4)</button>
        <button class="menu__action" data-mode="pvp">PvP (LAN, up to 4)</button>
        <button class="menu__action" data-back>← Back</button>
      </section>
    `;

    this.menuEl.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode!;
        this.menuEl?.classList.add("is-hidden");
        if (mode === "solo") {
          this.scene.start("MenuScene");
        } else {
          this.scene.start("LobbyScene", { mode });
        }
      });
    });

    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("MenuScene");
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/scenes/ModeScene.ts
git commit -m "feat: add ModeScene (Solo/Co-op/PvP selection)"
```

---

## Task 6: LobbyScene + Styles

**Files:**
- Create: `src/game/scenes/LobbyScene.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add lobby styles to `src/styles.css`**

Append to the end of `src/styles.css`:

```css
/* Lobby */
.lobby-input {
  display: block;
  width: 100%;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 2px solid #6a6655;
  background: #1a1a17;
  color: #f6efd5;
  font: inherit;
  font-size: 14px;
}

.lobby-input:focus {
  outline: none;
  border-color: #e1b652;
}

.lobby-players {
  margin-bottom: 14px;
}

.lobby-player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(244, 236, 210, 0.08);
  color: #f4ecd2;
  font-size: 14px;
  font-weight: 700;
}

.lobby-player__swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.lobby-player em {
  font-style: normal;
  font-size: 11px;
  color: #e1b652;
  margin-left: 6px;
}

/* Spectator bar */
#spectator-bar {
  position: fixed;
  bottom: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  background: rgba(13, 13, 12, 0.88);
  border: 1px solid rgba(244, 236, 210, 0.18);
  color: #f4ecd2;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  pointer-events: auto;
}

#spectator-bar.is-hidden {
  display: none;
}

#spectator-bar button {
  padding: 2px 10px;
  border: 1px solid #6a6655;
  background: #2c3128;
  color: #f6efd5;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
}

#spectator-bar button:hover {
  border-color: #e1b652;
}

/* PvP leaderboard */
#pvp-board {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 3;
  min-width: 140px;
  padding: 8px 10px;
  background: rgba(13, 13, 12, 0.78);
  border: 1px solid rgba(244, 236, 210, 0.18);
  pointer-events: none;
}

#pvp-board.is-hidden {
  display: none;
}

.pvp-board__row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
  font-weight: 800;
  color: #f4ecd2;
  text-transform: uppercase;
}

.pvp-board__row.dead {
  opacity: 0.35;
  text-decoration: line-through;
}
```

- [ ] **Step 2: Add spectator bar and pvp board to `index.html`**

In `index.html`, inside the `<div id="app">` block, after the `<div id="boss-hud">` element, add:

```html
      <div id="spectator-bar" class="is-hidden">
        Spectating: <span id="spectator-name">—</span>
        <button id="spectator-prev">◀</button>
        <button id="spectator-next">▶</button>
      </div>
      <div id="pvp-board" class="is-hidden"></div>
```

- [ ] **Step 3: Create `src/game/scenes/LobbyScene.ts`**

```typescript
import Phaser from "phaser";
import { ROOMS } from "../rooms";
import { network } from "../net/NetworkManager";
import type { GameMode, LobbyPlayer } from "../net/types";

interface LobbySceneData {
  mode: GameMode;
}

const PLAYER_COLORS = ["#ffffff", "#6ab0ff", "#6dff8a", "#ffd76a"];

export class LobbyScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private mode: GameMode = "coop";
  private players: LobbyPlayer[] = [];
  private myId: number | null = null;
  private isHost = false;
  private selectedRoom = ROOMS[0]?.key ?? "crossfire";

  constructor() {
    super("LobbyScene");
  }

  init(data: LobbySceneData): void {
    this.mode = data.mode;
    network.disconnect();
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    this.renderNameEntry();
  }

  private renderNameEntry(): void {
    if (!this.menuEl) return;
    this.menuEl.classList.remove("is-hidden");
    const modeLabel = this.mode === "coop" ? "Co-op" : "PvP";
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">${modeLabel}</h1>
        <input id="lobby-name" class="lobby-input" type="text" placeholder="Your name" maxlength="20" />
        <button class="menu__action" data-host>Host Game</button>
        <button class="menu__action" data-join>Join Game</button>
        <button class="menu__action" data-back>← Back</button>
      </section>
    `;
    this.menuEl.querySelector("[data-host]")?.addEventListener("click", () => {
      const name = this.getNameInput();
      this.startHost(name);
    });
    this.menuEl.querySelector("[data-join]")?.addEventListener("click", () => {
      const name = this.getNameInput();
      this.renderJoinForm(name);
    });
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("ModeScene");
    });
  }

  private getNameInput(): string {
    return (document.querySelector("#lobby-name") as HTMLInputElement)?.value.trim() || "Player";
  }

  private renderJoinForm(name: string): void {
    if (!this.menuEl) return;
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Join Game</h1>
        <input id="lobby-ip" class="lobby-input" type="text" placeholder="Host IP (e.g. 192.168.1.5)" />
        <button class="menu__action" data-connect>Connect</button>
        <button class="menu__action" data-back>← Back</button>
      </section>
    `;
    this.menuEl.querySelector("[data-connect]")?.addEventListener("click", async () => {
      const ip = (document.querySelector("#lobby-ip") as HTMLInputElement)?.value.trim();
      if (!ip) return;
      await this.connectToHost(ip, name);
    });
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.renderNameEntry();
    });
  }

  private async startHost(name: string): Promise<void> {
    try {
      await network.connect("localhost");
      this.setupHandlers(name);
    } catch {
      alert("Could not start server. Make sure you ran: npm run host");
    }
  }

  private async connectToHost(ip: string, name: string): Promise<void> {
    try {
      await network.connect(ip);
      this.setupHandlers(name);
    } catch {
      alert("Could not connect. Check the IP address and try again.");
    }
  }

  private setupHandlers(name: string): void {
    network.on("assigned", (msg) => {
      this.myId = msg.playerId;
      this.isHost = msg.isHost;
      network.send({ type: "join", name });
    });

    network.on("lobby_update", (msg) => {
      this.players = msg.players;
      this.renderLobby();
    });

    network.on("game_start", (msg) => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("GameScene", {
        roomKey: msg.roomKey,
        mode: msg.mode,
        seed: msg.seed,
        myId: this.myId,
        isHost: this.isHost,
        lobbyPlayers: msg.players,
      });
    });

    network.on("host_left", () => {
      network.disconnect();
      alert("Host disconnected.");
      this.scene.start("ModeScene");
    });

    network.on("error", (msg) => {
      alert(msg.message);
      this.scene.start("ModeScene");
    });
  }

  private renderLobby(): void {
    if (!this.menuEl) return;
    const rows = this.players
      .map((p, i) => `
        <div class="lobby-player">
          <span class="lobby-player__swatch" style="background:${PLAYER_COLORS[i] ?? "#fff"}"></span>
          <span class="lobby-player__name">${p.name}${p.isHost ? "<em>HOST</em>" : ""}</span>
        </div>`)
      .join("");

    const mapOptions = ROOMS.map((r) => `<option value="${r.key}">${r.name}</option>`).join("");
    const modeLabel = this.mode === "coop" ? "Co-op" : "PvP";

    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">${modeLabel} Lobby</h1>
        <div class="lobby-players">${rows}</div>
        ${this.isHost
          ? `<select id="lobby-room" class="lobby-input">${mapOptions}</select>
             <button class="menu__action" data-start>Start Game</button>`
          : `<p class="menu__copy">Waiting for host to start…</p>`}
      </section>
    `;

    if (this.isHost) {
      (document.querySelector("#lobby-room") as HTMLSelectElement | null)
        ?.addEventListener("change", (e) => {
          this.selectedRoom = (e.target as HTMLSelectElement).value;
        });
      this.menuEl.querySelector("[data-start]")?.addEventListener("click", () => {
        network.send({ type: "start_game", roomKey: this.selectedRoom, mode: this.mode });
      });
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/game/scenes/LobbyScene.ts src/styles.css index.html
git commit -m "feat: add LobbyScene, lobby/spectator CSS, DOM elements"
```

---

## Task 7: Wire Up New Scenes

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/scenes/MenuScene.ts`

- [ ] **Step 1: Update `src/main.ts`**

Replace the contents of `src/main.ts`:

```typescript
import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { GameScene } from "./game/scenes/GameScene";
import { LobbyScene } from "./game/scenes/LobbyScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { ModeScene } from "./game/scenes/ModeScene";
import "./styles.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#171717",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 }
    }
  },
  scene: [BootScene, MenuScene, ModeScene, LobbyScene, GameScene]
};

new Phaser.Game(config);
```

- [ ] **Step 2: Update `src/game/scenes/MenuScene.ts`**

In `MenuScene.ts`, find the room button click handler. Replace the `this.scene.start("GameScene", { roomKey })` line with `this.scene.start("ModeScene")` — and change what happens AFTER mode is selected.

Wait — actually, in the new flow, Solo mode still goes through MenuScene for map selection, then starts GameScene. So MenuScene's existing room buttons stay, but the main "Play" path now routes through ModeScene first.

The change is: the MenuScene title now has a "back" feel, and the initial entry point is ModeScene. Update `MenuScene.renderMenu` to add a back button and change the scene flow so clicking a room in Solo mode passes `mode: "solo"` to GameScene:

Replace the full contents of `src/game/scenes/MenuScene.ts`:

```typescript
import Phaser from "phaser";
import { ROOMS } from "../rooms";

export class MenuScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private hudEl: HTMLElement | null = null;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.menuEl = document.querySelector("#menu");
    this.hudEl = document.querySelector("#hud");
    this.hudEl?.classList.add("is-hidden");
    this.renderMenu();
  }

  private renderMenu(): void {
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Blockhead:<br />More Arenas</h1>
        <p class="menu__copy">
          Pick a room, hold the line, and survive the crowd. Move with WASD, aim with the mouse,
          fire with left click, cycle guns with Q, pick guns directly with 1-0, and use barrels before the room closes in.
        </p>
        <div class="room-grid">
          ${ROOMS.map(
            (room) => `
              <button class="room-button" data-room="${room.key}">
                ${room.name}
                <span>${room.description}</span>
              </button>
            `
          ).join("")}
        </div>
        <button class="menu__action" data-back>← Mode Select</button>
      </section>
    `;

    this.menuEl.querySelectorAll<HTMLButtonElement>("[data-room]").forEach((button) => {
      button.addEventListener("click", () => {
        const roomKey = button.dataset.room;
        if (!roomKey) return;
        this.menuEl?.classList.add("is-hidden");
        this.scene.start("GameScene", { roomKey, mode: "solo" });
      });
    });

    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("ModeScene");
    });
  }
}
```

- [ ] **Step 3: Update BootScene to start ModeScene last**

Open `src/game/scenes/BootScene.ts`. Find the line that says `this.scene.start("MenuScene")` and change it to `this.scene.start("ModeScene")`.

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/game/scenes/MenuScene.ts src/game/scenes/BootScene.ts
git commit -m "feat: wire ModeScene as entry, add LobbyScene to Phaser config"
```

---

## Task 8: GameScene – Types, Fields & Enemy IDs

**Files:**
- Modify: `src/game/scenes/GameScene.ts` (top section: imports, types, fields)

This task adds the new types and instance fields needed for multiplayer. No behaviour changes yet.

- [ ] **Step 1: Add imports at the top of `GameScene.ts`**

After the existing imports, add:

```typescript
import { network } from "../net/NetworkManager";
import type { GameMode, InputKeys, LobbyPlayer, StateSnapshot } from "../net/types";
```

- [ ] **Step 2: Add `PlayerSprite` type after `BossSprite` type**

```typescript
type PlayerSprite = Phaser.Physics.Arcade.Sprite & {
  playerId: number;
  playerName: string;
  nameLabel: Phaser.GameObjects.Text;
  dead: boolean;
  hp: number;
  score: number;
  currentWeaponKey: string;
  aimAngle: number;
  facingLeft: boolean;
  weaponImage: Phaser.GameObjects.Image;
  lastShotAt: number;
  ammo: Map<string, number>;
};
```

- [ ] **Step 3: Add `enemyId` and `pickupId` to existing sprite types**

In the `EnemySprite` type, add `enemyId: number;` after `deathHandled?: boolean;`.

In the `PickupSprite` type, change it to:

```typescript
type PickupSprite = Phaser.Physics.Arcade.Image & { kind: PickupKind; weaponKey?: WeaponKey; pickupId: number };
```

- [ ] **Step 4: Extend `GameSceneData`**

Replace the existing `GameSceneData` interface:

```typescript
interface GameSceneData {
  roomKey: string;
  mode?: GameMode;
  seed?: number;
  myId?: number;
  isHost?: boolean;
  lobbyPlayers?: LobbyPlayer[];
}
```

- [ ] **Step 5: Add multiplayer fields to the `GameScene` class**

After `private staticBlockedCells = new Set<string>();` add:

```typescript
private gameMode: GameMode = "solo";
private isHost = true;
private myId = 1;
private lobbyPlayers: LobbyPlayer[] = [];
private remotePlayers = new Map<number, PlayerSprite>();
private nextEnemyId = 1;
private nextPickupId = 1;
private lastBroadcastAt = 0;
private spectating = false;
private spectatorTargets: number[] = [];
private spectatorIndex = 0;
private spectatorBarEl: HTMLElement | null = null;
private spectatorNameEl: HTMLElement | null = null;
private pvpBoardEl: HTMLElement | null = null;
private latestSnapshot: StateSnapshot | null = null;
```

- [ ] **Step 6: Update `init()` to read the new data fields**

Replace the existing `init()` method:

```typescript
init(data: GameSceneData): void {
  this.room = getRoom(data.roomKey ?? "crossfire");
  this.gameMode = data.mode ?? "solo";
  this.myId = data.myId ?? 1;
  this.isHost = data.isHost ?? true;
  this.lobbyPlayers = data.lobbyPlayers ?? [];
  if (data.seed !== undefined) {
    // seed Math.random for visual consistency across clients
    let s = data.seed;
    const seeded = (): number => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967296;
    };
    Math.random = seeded;
  }
}
```

- [ ] **Step 7: Assign `enemyId` in `configureEnemy`**

In `configureEnemy` (around line 674), add at the very end of the method body before the closing `}`:

```typescript
enemy.enemyId = this.nextEnemyId++;
```

Also add it in `spawnBoss` before `this.enemies.add(boss)`:

```typescript
boss.enemyId = this.nextEnemyId++;
```

- [ ] **Step 8: Assign `pickupId` in `maybeDropPickup`**

In `maybeDropPickup`, after `const pickup = this.physics.add.image(...)`, add:

```typescript
pickup.pickupId = this.nextPickupId++;
```

- [ ] **Step 9: Build check**

```bash
npx tsc --noEmit
```

Expected: no errors (or only errors in methods we haven't updated yet — fix those by adding `// @ts-expect-error` temporarily if needed, but prefer real fixes).

- [ ] **Step 10: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: add multiplayer types, fields, enemy/pickup IDs to GameScene"
```

---

## Task 9: GameScene – Multi-Player Sprite Creation

**Files:**
- Modify: `src/game/scenes/GameScene.ts`

This task replaces `createPlayer()` with a version that creates sprites for all lobby players (in multiplayer) or just P1 (in solo). It also wires up DOM elements.

- [ ] **Step 1: Update `create()` to call new setup methods**

In the `create()` method, replace `this.createPlayer();` with:

```typescript
this.createAllPlayers();
```

And after `this.updateHud();` add:

```typescript
this.spectatorBarEl = document.querySelector("#spectator-bar");
this.spectatorNameEl = document.querySelector("#spectator-name");
this.pvpBoardEl = document.querySelector("#pvp-board");

if (this.gameMode !== "solo") {
  this.setupNetworkForGame();
}
```

Also update `resetRunState()` — add at the end:

```typescript
this.nextEnemyId = 1;
this.nextPickupId = 1;
this.lastBroadcastAt = 0;
this.spectating = false;
this.spectatorTargets = [];
this.spectatorIndex = 0;
this.latestSnapshot = null;
this.remotePlayers.clear();
```

- [ ] **Step 2: Add `createAllPlayers()` method**

Add this method after `createPlayer()`. Keep the old `createPlayer()` intact — it is called by `createAllPlayers()` for P1:

```typescript
private createAllPlayers(): void {
  // Always create local player (P1 / solo)
  this.createPlayer();

  if (this.gameMode === "solo" || this.lobbyPlayers.length === 0) return;

  const TINTS = [0xffffff, 0x6ab0ff, 0x6dff8a, 0xffd76a];

  // Create remote player sprites for all other lobby members
  for (const lp of this.lobbyPlayers) {
    if (lp.id === this.myId) {
      // Tint local player
      const tint = TINTS[(lp.id - 1) % 4] ?? 0xffffff;
      if (tint !== 0xffffff) this.player.setTint(tint);
      continue;
    }

    const spawn = this.room.playerStart;
    const sprite = this.physics.add.sprite(spawn.x, spawn.y, "player") as PlayerSprite;
    sprite.playerId = lp.id;
    sprite.playerName = lp.name;
    sprite.dead = false;
    sprite.hp = 100;
    sprite.score = 0;
    sprite.currentWeaponKey = "pistol";
    sprite.aimAngle = 0;
    sprite.facingLeft = false;
    sprite.lastShotAt = 0;
    sprite.ammo = new Map(WEAPONS.map((w) => [w.key, w.key === "pistol" ? Number.POSITIVE_INFINITY : 0]));

    const tint = TINTS[(lp.id - 1) % 4] ?? 0xffffff;
    if (tint !== 0xffffff) sprite.setTint(tint);

    sprite.setCollideWorldBounds(true);
    sprite.setDrag(900, 900);
    sprite.setMaxVelocity(220);
    sprite.setDepth(4);
    sprite.body!.setSize(30, 28);
    sprite.body!.setOffset(11, 7);

    const weaponImg = this.add.image(spawn.x, spawn.y, "player-weapon-pistol");
    weaponImg.setOrigin(0.15, 0.5);
    weaponImg.setDepth(4.4);
    sprite.weaponImage = weaponImg;

    const nameLabel = this.add.text(spawn.x, spawn.y - 28, lp.name, {
      fontSize: "10px",
      color: "#f4ecd2",
      stroke: "#000000",
      strokeThickness: 3,
      fontStyle: "bold"
    });
    nameLabel.setOrigin(0.5, 1);
    nameLabel.setDepth(6);
    sprite.nameLabel = nameLabel;

    this.remotePlayers.set(lp.id, sprite);

    // Remote players collide with walls
    this.physics.add.collider(sprite, this.walls);
    this.physics.add.collider(sprite, this.barricades);
  }

  // Add local player name label too
  const myLobbyPlayer = this.lobbyPlayers.find((lp) => lp.id === this.myId);
  if (myLobbyPlayer) {
    const nameLabel = this.add.text(this.player.x, this.player.y - 28, myLobbyPlayer.name, {
      fontSize: "10px",
      color: "#f4ecd2",
      stroke: "#000000",
      strokeThickness: 3,
      fontStyle: "bold"
    });
    nameLabel.setOrigin(0.5, 1);
    nameLabel.setDepth(6);
    // store on player sprite via casting
    (this.player as unknown as PlayerSprite).nameLabel = nameLabel;
  }
}
```

- [ ] **Step 3: Update `update()` to tick name labels and remote weapon images**

In `update()`, after `this.updateHud();` add:

```typescript
this.updateRemotePlayerLabels();
```

Add the method:

```typescript
private updateRemotePlayerLabels(): void {
  for (const sprite of this.remotePlayers.values()) {
    if (!sprite.active) continue;
    sprite.nameLabel?.setPosition(sprite.x, sprite.y - 28);
    sprite.weaponImage?.setPosition(sprite.x, sprite.y);
    sprite.weaponImage?.setRotation(sprite.aimAngle);
    sprite.weaponImage?.setFlipY(sprite.facingLeft);
  }
  // local player label
  const myLabel = (this.player as unknown as PlayerSprite).nameLabel;
  if (myLabel) myLabel.setPosition(this.player.x, this.player.y - 28);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: create all lobby player sprites with colours and name labels"
```

---

## Task 10: GameScene – Host Simulation & State Broadcast

**Files:**
- Modify: `src/game/scenes/GameScene.ts`

This task adds host-only logic: drain relayed inputs from NetworkManager, apply them to remote player sprites, and broadcast state snapshots at 20 Hz.

- [ ] **Step 1: Add `setupNetworkForGame()` method**

```typescript
private setupNetworkForGame(): void {
  if (this.gameMode === "solo") return;

  network.on("input_relay", (msg) => {
    network.enqueueInput({
      playerId: msg.playerId,
      keys: msg.keys,
      aimAngle: msg.aimAngle,
      shooting: msg.shooting,
    });
  });

  if (!this.isHost) {
    network.on("state", (msg) => {
      this.latestSnapshot = {
        wave: msg.wave,
        players: msg.players,
        enemies: msg.enemies,
        boss: msg.boss,
        pickups: msg.pickups,
      };
    });
  }

  network.on("player_left", (msg) => {
    const sprite = this.remotePlayers.get(msg.playerId);
    if (sprite) {
      sprite.nameLabel?.destroy();
      sprite.weaponImage?.destroy();
      sprite.destroy();
      this.remotePlayers.delete(msg.playerId);
    }
  });

  network.on("host_left", () => {
    this.scene.start("ModeScene");
  });
}
```

- [ ] **Step 2: Add `applyRemoteInputs()` called from `update()` on the host**

In `update()`, after `this.updatePlayer();` add:

```typescript
if (this.isHost && this.gameMode !== "solo") {
  this.applyRemoteInputs();
}
```

Add the method:

```typescript
private applyRemoteInputs(): void {
  const inputs = network.drainInputs();
  for (const input of inputs) {
    const sprite = this.remotePlayers.get(input.playerId);
    if (!sprite || !sprite.active || sprite.dead) continue;

    const vel = new Phaser.Math.Vector2(
      Number(input.keys.right) - Number(input.keys.left),
      Number(input.keys.down) - Number(input.keys.up)
    );
    if (vel.lengthSq() > 0) vel.normalize().scale(218);
    sprite.setVelocity(vel.x, vel.y);

    sprite.aimAngle = input.aimAngle;
    sprite.facingLeft = Math.cos(input.aimAngle) < 0;
    sprite.setFlipX(sprite.facingLeft);
    sprite.weaponImage?.setRotation(input.aimAngle);

    if (input.shooting) {
      this.handleRemoteShoot(sprite);
    }
  }
}
```

- [ ] **Step 3: Add `handleRemoteShoot()` for remote player bullets**

```typescript
private handleRemoteShoot(sprite: PlayerSprite): void {
  const now = this.time.now;
  const weapon = getWeapon(sprite.currentWeaponKey as WeaponKey);
  if (now - sprite.lastShotAt < weapon.fireRateMs) return;
  const ammoCount = sprite.ammo.get(weapon.key) ?? 0;
  if (ammoCount < weapon.ammoPerShot) return;

  sprite.lastShotAt = now;
  if (Number.isFinite(ammoCount)) {
    sprite.ammo.set(weapon.key, Math.max(0, ammoCount - weapon.ammoPerShot));
  }

  const baseAngle = sprite.aimAngle;
  for (let i = 0; i < weapon.pellets; i++) {
    const offset = weapon.pellets === 1
      ? 0
      : Phaser.Math.Linear(-weapon.spread, weapon.spread, i / (weapon.pellets - 1));
    const spawn = spawnPointFromAngle(sprite, baseAngle + offset, 42);
    const velocity = velocityFromAngle(baseAngle + offset, weapon.bulletSpeed);
    const bullet = this.bullets.create(spawn.x, spawn.y, "bullet") as BulletSprite;
    bullet.setTint(weapon.color);
    bullet.setRotation(baseAngle + offset);
    bullet.setDepth(5);
    bullet.setActive(true).setVisible(true);
    bullet.body!.enable = true;
    bullet.setVelocity(velocity.x, velocity.y);
    bullet.damage = weapon.damage;
    bullet.pierce = weapon.pierce ?? 0;
    bullet.explosiveRadius = weapon.explosiveRadius ?? 0;
    bullet.bornAt = now;
  }
}
```

- [ ] **Step 4: Add `broadcastState()` and call it at 20 Hz from `update()`**

In `update()`, after `this.updateHud();` add:

```typescript
if (this.isHost && this.gameMode !== "solo" && time - this.lastBroadcastAt >= 50) {
  this.lastBroadcastAt = time;
  this.broadcastState();
}
```

Add the method:

```typescript
private broadcastState(): void {
  const players: StateSnapshot["players"] = [];

  // local player (P1)
  players.push({
    id: this.myId,
    x: this.player.x,
    y: this.player.y,
    hp: this.health,
    aimAngle: this.aimAngle,
    weaponKey: this.currentWeapon.key,
    score: this.score,
    dead: this.gameOver,
    facingLeft: this.facingDirection < 0,
  });

  // remote players
  for (const [id, sprite] of this.remotePlayers.entries()) {
    players.push({
      id,
      x: sprite.x,
      y: sprite.y,
      hp: sprite.hp,
      aimAngle: sprite.aimAngle,
      weaponKey: sprite.currentWeaponKey,
      score: sprite.score,
      dead: sprite.dead,
      facingLeft: sprite.facingLeft,
    });
  }

  const enemies: StateSnapshot["enemies"] = (this.enemies.getChildren() as EnemySprite[])
    .filter((e) => e.active)
    .map((e) => ({ id: e.enemyId, x: e.x, y: e.y, hp: e.hp, kind: e.kind }));

  const boss: StateSnapshot["boss"] = this.boss?.active
    ? { x: this.boss.x, y: this.boss.y, hp: this.boss.hp, maxHp: this.boss.maxHp }
    : null;

  const pickups: StateSnapshot["pickups"] = (this.pickups.getChildren() as PickupSprite[])
    .filter((p) => p.active)
    .map((p) => ({ id: p.pickupId, x: p.x, y: p.y, kind: p.kind }));

  network.send({
    type: "state",
    payload: { wave: this.waveNumber, players, enemies, boss, pickups },
  });
}
```

- [ ] **Step 5: Update `getNearestAlivePlayer()` helper for enemy targeting**

Add this method (enemies on the host target the nearest alive player):

```typescript
private getNearestAlivePlayer(): { x: number; y: number } {
  if (this.gameMode === "solo" || !this.isHost) {
    return { x: this.player.x, y: this.player.y };
  }

  let nearest: { x: number; y: number } = { x: this.player.x, y: this.player.y };
  let minDist = Number.POSITIVE_INFINITY;

  const candidates: Array<{ x: number; y: number; dead?: boolean }> = [
    { x: this.player.x, y: this.player.y, dead: this.gameOver },
  ];
  for (const sprite of this.remotePlayers.values()) {
    if (!sprite.dead) candidates.push(sprite);
  }

  // reference point: use last-known enemy target (doesn't matter which enemy)
  // just pick the first active enemy or origin
  for (const candidate of candidates) {
    if (candidate.dead) continue;
    const dist = Phaser.Math.Distance.Between(0, 0, candidate.x, candidate.y);
    if (dist < minDist) { minDist = dist; nearest = candidate; }
  }
  return nearest;
}
```

Then in `navigateEnemy` (around line 458), replace the first two lines:

```typescript
// BEFORE:
const canChaseDirectly = this.hasClearPath(enemy.x, enemy.y, this.player.x, this.player.y);
let target = new Phaser.Math.Vector2(this.player.x, this.player.y);

// AFTER:
const nearestPlayer = this.getNearestAlivePlayer();
const canChaseDirectly = this.hasClearPath(enemy.x, enemy.y, nearestPlayer.x, nearestPlayer.y);
let target = new Phaser.Math.Vector2(nearestPlayer.x, nearestPlayer.y);
```

In `updateRangedEnemy`, replace all `this.player.x` / `this.player.y` references with `this.getNearestAlivePlayer().x` / `.y`.

In `updateEnemies`, the touch damage block:

```typescript
// BEFORE:
if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 32) {
  enemy.touchCooldown -= delta;
  if (enemy.touchCooldown <= 0) {
    enemy.touchCooldown = enemy.touchCooldownMs;
    this.tweens.add({ targets: enemy, scaleX: 1.12, scaleY: 0.88, yoyo: true, duration: 90 });
    this.damagePlayer(enemy.damage);
  }
}

// AFTER:
const localDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
if (localDist < 32) {
  enemy.touchCooldown -= delta;
  if (enemy.touchCooldown <= 0) {
    enemy.touchCooldown = enemy.touchCooldownMs;
    this.tweens.add({ targets: enemy, scaleX: 1.12, scaleY: 0.88, yoyo: true, duration: 90 });
    this.damagePlayer(enemy.damage);
  }
} else if (this.isHost && this.gameMode !== "solo") {
  for (const sprite of this.remotePlayers.values()) {
    if (sprite.dead) continue;
    if (Phaser.Math.Distance.Between(enemy.x, enemy.y, sprite.x, sprite.y) < 32) {
      enemy.touchCooldown -= delta;
      if (enemy.touchCooldown <= 0) {
        enemy.touchCooldown = enemy.touchCooldownMs;
        sprite.hp = Math.max(0, sprite.hp - enemy.damage);
        if (sprite.hp <= 0) this.killRemotePlayer(sprite);
      }
      break;
    }
  }
}
```

- [ ] **Step 6: Add `killRemotePlayer()` method**

```typescript
private killRemotePlayer(sprite: PlayerSprite): void {
  if (sprite.dead) return;
  sprite.dead = true;
  sprite.body!.enable = false;
  sprite.setVelocity(0, 0);
  this.tweens.add({ targets: sprite, alpha: 0.25, duration: 300 });
  this.checkMultiplayerGameOver();
}
```

- [ ] **Step 7: Build check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: host simulation - apply remote inputs, broadcast state snapshots"
```

---

## Task 11: GameScene – Client Snapshot Rendering

**Files:**
- Modify: `src/game/scenes/GameScene.ts`

Non-host clients apply the latest received snapshot to all sprites each frame.

- [ ] **Step 1: Add `applySnapshot()` call in `update()`**

In `update()`, after `if (this.gameOver) return;` add:

```typescript
if (!this.isHost && this.gameMode !== "solo" && this.latestSnapshot) {
  this.applySnapshot(this.latestSnapshot);
  this.latestSnapshot = null;
}
```

- [ ] **Step 2: Add `applySnapshot()` method**

```typescript
private applySnapshot(snap: StateSnapshot): void {
  this.waveNumber = snap.wave;

  // Update all player sprites
  for (const ps of snap.players) {
    if (ps.id === this.myId) {
      // Correct local player state from authority
      this.health = ps.hp;
      this.score = ps.score;
      // Don't override position — client predicts local movement
    } else {
      const sprite = this.remotePlayers.get(ps.id);
      if (!sprite) continue;
      sprite.setPosition(ps.x, ps.y);
      sprite.hp = ps.hp;
      sprite.score = ps.score;
      sprite.aimAngle = ps.aimAngle;
      sprite.facingLeft = ps.facingLeft;
      sprite.setFlipX(ps.facingLeft);
      sprite.weaponImage?.setTexture(HELD_WEAPON_TEXTURES[ps.weaponKey as WeaponKey] ?? "player-weapon-pistol");
      sprite.weaponImage?.setRotation(ps.aimAngle);
      if (ps.dead && !sprite.dead) {
        sprite.dead = true;
        this.tweens.add({ targets: sprite, alpha: 0.25, duration: 300 });
      }
    }
  }

  // Sync enemy positions (non-host just moves them)
  const liveEnemyIds = new Set(snap.enemies.map((e) => e.id));
  for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
    if (!liveEnemyIds.has(enemy.enemyId)) {
      enemy.destroy();
    }
  }
  for (const es of snap.enemies) {
    let found = (this.enemies.getChildren() as EnemySprite[]).find((e) => e.enemyId === es.id);
    if (!found) {
      // Spawn a visual-only ghost enemy
      const ghost = this.enemies.create(es.x, es.y, `enemy-${es.kind}`) as EnemySprite;
      ghost.enemyId = es.id;
      ghost.kind = es.kind;
      ghost.hp = es.hp;
      ghost.body!.enable = false; // no physics on client
      ghost.setDepth(3);
    } else {
      found.setPosition(es.x, es.y);
      found.hp = es.hp;
    }
  }

  // Boss
  if (snap.boss && this.boss?.active) {
    this.boss.setPosition(snap.boss.x, snap.boss.y);
    this.boss.hp = snap.boss.hp;
    this.updateBossHud();
  } else if (!snap.boss && this.boss?.active) {
    this.boss.destroy();
    this.boss = null;
    this.updateBossHud();
  }
}
```

- [ ] **Step 3: Non-host client: send local input every frame**

In `update()`, after `this.updatePlayer();` add:

```typescript
if (!this.isHost && this.gameMode !== "solo") {
  this.sendLocalInput();
}
```

Add the method:

```typescript
private sendLocalInput(): void {
  const left = this.keys.A.isDown || this.cursors.left?.isDown;
  const right = this.keys.D.isDown || this.cursors.right?.isDown;
  const up = this.keys.W.isDown || this.cursors.up?.isDown;
  const down = this.keys.S.isDown || this.cursors.down?.isDown;
  network.send({
    type: "input",
    keys: { up: !!up, down: !!down, left: !!left, right: !!right },
    aimAngle: this.aimAngle,
    shooting: this.input.activePointer.isDown,
  });
}
```

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: client snapshot apply - sync enemy/player positions from host"
```

---

## Task 12: GameScene – Friendly Fire

**Files:**
- Modify: `src/game/scenes/GameScene.ts`

- [ ] **Step 1: Add PvP bullet-vs-remote-player overlaps in `createCollisions()`**

At the end of `createCollisions()`, add:

```typescript
if (this.gameMode === "pvp") {
  for (const sprite of this.remotePlayers.values()) {
    this.physics.add.overlap(this.bullets, sprite, (bullet) => {
      const b = bullet as BulletSprite;
      sprite.hp = Math.max(0, sprite.hp - b.damage);
      b.destroy();
      if (sprite.hp <= 0 && !sprite.dead) this.killRemotePlayer(sprite);
    });
  }
  // Enemy projectiles can also hit remote players on host
  if (this.isHost) {
    for (const sprite of this.remotePlayers.values()) {
      this.physics.add.overlap(this.enemyProjectiles, sprite, (_proj, sp) => {
        const proj = _proj as EnemyProjectileSprite;
        (sp as PlayerSprite).hp = Math.max(0, (sp as PlayerSprite).hp - proj.damage);
        proj.destroy();
        if ((sp as PlayerSprite).hp <= 0 && !(sp as PlayerSprite).dead) {
          this.killRemotePlayer(sp as PlayerSprite);
        }
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: PvP friendly fire - bullets damage remote players"
```

---

## Task 13: GameScene – Spectator Mode & Game Over

**Files:**
- Modify: `src/game/scenes/GameScene.ts`

- [ ] **Step 1: Update `endRun()` (local player dies in multiplayer)**

Replace the existing `endRun()` method:

```typescript
private endRun(): void {
  if (this.gameMode !== "solo") {
    this.enterSpectatorMode();
    this.checkMultiplayerGameOver();
    return;
  }
  this.gameOver = true;
  this.physics.pause();
  this.playerWeapon.setVisible(false);
  this.hudEl?.classList.add("is-hidden");
  this.bossHudEl?.classList.add("is-hidden");
  if (!this.menuEl) return;

  this.menuEl.classList.remove("is-hidden");
  this.menuEl.innerHTML = `
    <section class="menu__panel">
      <h1 class="menu__title">Run Over</h1>
      <p class="menu__copy">Score ${this.score}. You reached wave ${this.waveNumber} in ${this.room.name}.</p>
      <button class="menu__action" data-retry>Retry Room</button>
      <button class="menu__action" data-menu>Choose Another Room</button>
    </section>
  `;
  this.menuEl.querySelector("[data-retry]")?.addEventListener("click", () => {
    this.menuEl?.classList.add("is-hidden");
    this.scene.restart({ roomKey: this.room.key, mode: "solo" });
  });
  this.menuEl.querySelector("[data-menu]")?.addEventListener("click", () => {
    this.scene.start("ModeScene");
  });
}
```

- [ ] **Step 2: Add `enterSpectatorMode()` method**

```typescript
private enterSpectatorMode(): void {
  this.spectating = true;
  this.player.setAlpha(0.25);
  this.playerWeapon.setVisible(false);
  this.player.setVelocity(0, 0);

  // Build list of alive players to follow
  this.spectatorTargets = [];
  for (const [id, sprite] of this.remotePlayers.entries()) {
    if (!sprite.dead) this.spectatorTargets.push(id);
  }
  this.spectatorIndex = 0;

  if (this.spectatorTargets.length > 0) {
    this.followSpectatorTarget();
  }

  // Show spectator bar
  if (this.spectatorBarEl) {
    this.spectatorBarEl.classList.remove("is-hidden");
  }
  document.querySelector("#spectator-prev")?.addEventListener("click", () => this.prevSpectatorTarget());
  document.querySelector("#spectator-next")?.addEventListener("click", () => this.nextSpectatorTarget());
  // Keyboard: comma = prev, period = next
  this.keys["COMMA"] = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA);
  this.keys["PERIOD"] = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD);
}

private followSpectatorTarget(): void {
  const targetId = this.spectatorTargets[this.spectatorIndex];
  if (targetId === undefined) return;
  const sprite = this.remotePlayers.get(targetId);
  if (!sprite) return;
  this.cameras.main.startFollow(sprite, true, 0.08, 0.08);
  if (this.spectatorNameEl) {
    const lp = this.lobbyPlayers.find((p) => p.id === targetId);
    this.spectatorNameEl.textContent = lp?.name ?? "Player";
  }
}

private nextSpectatorTarget(): void {
  if (this.spectatorTargets.length === 0) return;
  this.spectatorIndex = (this.spectatorIndex + 1) % this.spectatorTargets.length;
  this.followSpectatorTarget();
}

private prevSpectatorTarget(): void {
  if (this.spectatorTargets.length === 0) return;
  this.spectatorIndex = (this.spectatorIndex - 1 + this.spectatorTargets.length) % this.spectatorTargets.length;
  this.followSpectatorTarget();
}
```

- [ ] **Step 3: Poll spectator keyboard in `update()`**

In `update()`, after `if (this.gameOver) return;` add:

```typescript
if (this.spectating) {
  if (Phaser.Input.Keyboard.JustDown(this.keys["COMMA"])) this.prevSpectatorTarget();
  if (Phaser.Input.Keyboard.JustDown(this.keys["PERIOD"])) this.nextSpectatorTarget();
  this.updatePvpBoard();
  return;
}
```

- [ ] **Step 4: Add `checkMultiplayerGameOver()` and `updatePvpBoard()` methods**

```typescript
private checkMultiplayerGameOver(): void {
  if (this.gameMode === "coop") {
    const anyAlive =
      (!this.gameOver && !this.spectating) ||
      [...this.remotePlayers.values()].some((s) => !s.dead);
    if (!anyAlive) this.showMultiplayerRunOver();
  } else if (this.gameMode === "pvp") {
    const aliveRemote = [...this.remotePlayers.values()].filter((s) => !s.dead);
    const localAlive = !this.gameOver && !this.spectating;
    const totalAlive = (localAlive ? 1 : 0) + aliveRemote.length;
    if (totalAlive <= 1) {
      const winner = localAlive
        ? this.lobbyPlayers.find((p) => p.id === this.myId)?.name ?? "You"
        : aliveRemote.length === 1
        ? this.lobbyPlayers.find((p) => p.id === aliveRemote[0]!.playerId)?.name ?? "Player"
        : null;
      this.showMultiplayerRunOver(winner ?? undefined);
    }
  }
}

private showMultiplayerRunOver(winner?: string): void {
  this.physics.pause();
  this.spectatorBarEl?.classList.add("is-hidden");
  this.pvpBoardEl?.classList.add("is-hidden");
  if (!this.menuEl) return;

  const title = this.gameMode === "pvp" && winner ? `${winner} Wins!` : "Run Over";
  const body = `Wave ${this.waveNumber} in ${this.room.name}.`;

  this.menuEl.classList.remove("is-hidden");
  this.menuEl.innerHTML = `
    <section class="menu__panel">
      <h1 class="menu__title">${title}</h1>
      <p class="menu__copy">${body}</p>
      <button class="menu__action" data-menu>Back to Menu</button>
    </section>
  `;
  this.menuEl.querySelector("[data-menu]")?.addEventListener("click", () => {
    network.disconnect();
    this.scene.start("ModeScene");
  });
}

private updatePvpBoard(): void {
  if (this.gameMode !== "pvp" || !this.pvpBoardEl) return;
  this.pvpBoardEl.classList.remove("is-hidden");

  const entries = this.lobbyPlayers.map((lp) => {
    const isLocal = lp.id === this.myId;
    const score = isLocal ? this.score : (this.remotePlayers.get(lp.id)?.score ?? 0);
    const dead = isLocal ? (this.gameOver || this.spectating) : (this.remotePlayers.get(lp.id)?.dead ?? false);
    return { name: lp.name, score, dead };
  });
  entries.sort((a, b) => b.score - a.score);

  this.pvpBoardEl.innerHTML = entries
    .map((e) => `<div class="pvp-board__row${e.dead ? " dead" : ""}"><span>${e.name}</span><span>${e.score}</span></div>`)
    .join("");
}
```

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/scenes/GameScene.ts
git commit -m "feat: spectator mode, camera cycling, co-op/pvp game over"
```

---

## Task 14: Smoke Test & Final Cleanup

**Files:**
- Modify: `src/game/scenes/GameScene.ts` (endRun back button)

- [ ] **Step 1: Verify solo mode still works**

```bash
npm run dev
```

Open `http://localhost:5173`. Click Solo → pick a room. Play through wave 1. Verify:
- Player moves, shoots, enemies spawn
- HUD shows HP / Wave / Score / Ammo
- Boss spawns on wave 5
- Run over screen appears on death
- "Mode Select" button returns to ModeScene

- [ ] **Step 2: Smoke test multiplayer (two browser tabs)**

```bash
npm run host
```

Open two tabs at `http://localhost:5173`.

**Tab 1:** Co-op → Host Game → enter name → Host Game (connects to localhost).
**Tab 2:** Co-op → Host Game (will get "server full" after 4) — actually: Co-op → Join Game → `localhost` → Connect.

Verify:
- Both tabs show each other in the lobby player list
- Host sees "Start Game" button, non-host sees "Waiting…"
- Host clicks Start → both tabs enter GameScene
- Both player sprites appear with names and colours
- Enemies spawn and move toward nearest player

- [ ] **Step 3: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (existing + new network tests).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete local-network multiplayer (Co-op + PvP)"
```

---

## Quick Reference: Running the Game

| Command | Purpose |
|---------|---------|
| `npm run dev` | Solo play only (localhost) |
| `npm run host` | Start relay server + serve game on LAN |
| `npm run test` | Run all tests |

Other players on the same WiFi open: `http://<host-ip>:5173`

Host's local IP on Windows: `ipconfig` → look for IPv4 Address under Wi-Fi adapter.
