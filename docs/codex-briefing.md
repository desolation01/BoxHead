# BoxHead Multiplayer — Codex Briefing

**Project:** `c:\Users\ediwo\OneDrive\Desktop\Cursor\Games\BoxHead`  
**Branch:** `feature/multiplayer`  
**Stack:** Phaser 3, TypeScript, Vite, Node.js `ws`, `concurrently`

---

## What This Feature Is

Adding local-network multiplayer (up to 4 players on the same WiFi) with three modes:

| Mode | Friendly Fire | End Condition |
|------|--------------|---------------|
| Solo | n/a | Local player dies |
| Co-op | Off | All players dead |
| PvP | On | Last player standing |

One player runs `npm run host` (starts Vite + WebSocket relay server). Others open `http://<host-ip>:5173` in their browser. Everyone types a name before joining. Dead players enter spectator mode and can cycle cameras through alive players.

**Architecture:** Host's browser runs the authoritative Phaser simulation for all players. Non-host clients send inputs every frame; host broadcasts state snapshots at 20 Hz. Relay server (`server.js`) only routes messages — no game logic.

---

## What Is Already Done (committed to `feature/multiplayer`)

| Task | Files | Status |
|------|-------|--------|
| 1 | `package.json` — `ws`, `concurrently`, `@types/ws`; `host` script | ✅ Done |
| 2 | `src/game/net/types.ts` — all TS network types | ✅ Done |
| 3 | `src/game/net/NetworkManager.ts` — WS client, input queue, singleton `network` | ✅ Done |
| 4 | `server.js` — Node.js WS relay (port 3001) | ✅ Done |
| 5 | `src/game/scenes/ModeScene.ts` — Solo/Co-op/PvP selection UI | ✅ Done |

Verify with: `npm run test` → 12 tests, 3 files, all passing.

---

## What Needs to Be Done (Tasks 6–14)

Implement each task in order. After each task run `npm run test` (must stay at 12 passing), then commit.

---

### Task 6: LobbyScene + Styles

**Files:** Create `src/game/scenes/LobbyScene.ts`, modify `src/styles.css`, modify `index.html`

#### Step 1 — Append to `src/styles.css`

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
.lobby-input:focus { outline: none; border-color: #e1b652; }
.lobby-players { margin-bottom: 14px; }
.lobby-player {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid rgba(244,236,210,0.08);
  color: #f4ecd2; font-size: 14px; font-weight: 700;
}
.lobby-player__swatch {
  width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;
}
.lobby-player em {
  font-style: normal; font-size: 11px; color: #e1b652; margin-left: 6px;
}

/* Spectator bar */
#spectator-bar {
  position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
  z-index: 5; display: flex; align-items: center; gap: 12px;
  padding: 8px 18px; background: rgba(13,13,12,0.88);
  border: 1px solid rgba(244,236,210,0.18); color: #f4ecd2;
  font-size: 13px; font-weight: 800; text-transform: uppercase; pointer-events: auto;
}
#spectator-bar.is-hidden { display: none; }
#spectator-bar button {
  padding: 2px 10px; border: 1px solid #6a6655; background: #2c3128;
  color: #f6efd5; cursor: pointer; font: inherit; font-size: 13px; font-weight: 900;
}
#spectator-bar button:hover { border-color: #e1b652; }

/* PvP leaderboard */
#pvp-board {
  position: fixed; top: 14px; right: 14px; z-index: 3; min-width: 140px;
  padding: 8px 10px; background: rgba(13,13,12,0.78);
  border: 1px solid rgba(244,236,210,0.18); pointer-events: none;
}
#pvp-board.is-hidden { display: none; }
.pvp-board__row {
  display: flex; gap: 8px; align-items: center; padding: 3px 0;
  font-size: 12px; font-weight: 800; color: #f4ecd2; text-transform: uppercase;
}
.pvp-board__row.dead { opacity: 0.35; text-decoration: line-through; }
```

#### Step 2 — Add DOM elements to `index.html`

In `index.html`, after the closing `</div>` of `<div id="boss-hud">`, add:

```html
      <div id="spectator-bar" class="is-hidden">
        Spectating: <span id="spectator-name">—</span>
        <button id="spectator-prev">◀</button>
        <button id="spectator-next">▶</button>
      </div>
      <div id="pvp-board" class="is-hidden"></div>
```

#### Step 3 — Create `src/game/scenes/LobbyScene.ts`

```typescript
import Phaser from "phaser";
import { ROOMS } from "../rooms";
import { network } from "../net/NetworkManager";
import type { GameMode, LobbyPlayer } from "../net/types";

interface LobbySceneData { mode: GameMode; }
const PLAYER_COLORS = ["#ffffff", "#6ab0ff", "#6dff8a", "#ffd76a"];

export class LobbyScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private mode: GameMode = "coop";
  private players: LobbyPlayer[] = [];
  private myId: number | null = null;
  private isHost = false;
  private selectedRoom = ROOMS[0]?.key ?? "crossfire";

  constructor() { super("LobbyScene"); }

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
        <input id="lobby-name" class="lobby-input" type="text"
               placeholder="Your name" maxlength="20" />
        <button class="menu__action" data-host>Host Game</button>
        <button class="menu__action" data-join>Join Game</button>
        <button class="menu__action" data-back>← Back</button>
      </section>`;
    this.menuEl.querySelector("[data-host]")?.addEventListener("click", () =>
      this.startHost(this.getNameInput()));
    this.menuEl.querySelector("[data-join]")?.addEventListener("click", () =>
      this.renderJoinForm(this.getNameInput()));
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () => {
      this.menuEl?.classList.add("is-hidden");
      this.scene.start("ModeScene");
    });
  }

  private getNameInput(): string {
    return (document.querySelector("#lobby-name") as HTMLInputElement)
      ?.value.trim() || "Player";
  }

  private renderJoinForm(name: string): void {
    if (!this.menuEl) return;
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">Join Game</h1>
        <input id="lobby-ip" class="lobby-input" type="text"
               placeholder="Host IP (e.g. 192.168.1.5)" />
        <button class="menu__action" data-connect>Connect</button>
        <button class="menu__action" data-back>← Back</button>
      </section>`;
    this.menuEl.querySelector("[data-connect]")?.addEventListener("click", async () => {
      const ip = (document.querySelector("#lobby-ip") as HTMLInputElement)?.value.trim();
      if (ip) await this.connectToHost(ip, name);
    });
    this.menuEl.querySelector("[data-back]")?.addEventListener("click", () =>
      this.renderNameEntry());
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
    const rows = this.players.map((p, i) => `
      <div class="lobby-player">
        <span class="lobby-player__swatch"
              style="background:${PLAYER_COLORS[i] ?? "#fff"}"></span>
        <span>${p.name}${p.isHost ? "<em>HOST</em>" : ""}</span>
      </div>`).join("");
    const mapOptions = ROOMS.map((r) =>
      `<option value="${r.key}">${r.name}</option>`).join("");
    const modeLabel = this.mode === "coop" ? "Co-op" : "PvP";
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">${modeLabel} Lobby</h1>
        <div class="lobby-players">${rows}</div>
        ${this.isHost
          ? `<select id="lobby-room" class="lobby-input">${mapOptions}</select>
             <button class="menu__action" data-start>Start Game</button>`
          : `<p class="menu__copy">Waiting for host to start…</p>`}
      </section>`;
    if (this.isHost) {
      (document.querySelector("#lobby-room") as HTMLSelectElement | null)
        ?.addEventListener("change", (e) => {
          this.selectedRoom = (e.target as HTMLSelectElement).value;
        });
      this.menuEl.querySelector("[data-start]")?.addEventListener("click", () =>
        network.send({ type: "start_game", roomKey: this.selectedRoom, mode: this.mode }));
    }
  }
}
```

#### Step 4 — Commit

```bash
git add src/game/scenes/LobbyScene.ts src/styles.css index.html
git commit -m "feat: add LobbyScene, lobby/spectator CSS, DOM elements"
```

---

### Task 7: Wire Up New Scenes

**Files:** Replace `src/main.ts`, replace `src/game/scenes/MenuScene.ts`, patch `src/game/scenes/BootScene.ts`

#### Step 1 — Replace `src/main.ts`

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
    height: 640,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  scene: [BootScene, MenuScene, ModeScene, LobbyScene, GameScene],
};

new Phaser.Game(config);
```

#### Step 2 — Replace `src/game/scenes/MenuScene.ts`

```typescript
import Phaser from "phaser";
import { ROOMS } from "../rooms";

export class MenuScene extends Phaser.Scene {
  private menuEl: HTMLElement | null = null;
  private hudEl: HTMLElement | null = null;

  constructor() { super("MenuScene"); }

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
          Pick a room, hold the line, and survive the crowd.
          Move with WASD, aim with the mouse, fire with left click,
          cycle guns with Q, pick guns directly with 1-0, and use barrels
          before the room closes in.
        </p>
        <div class="room-grid">
          ${ROOMS.map((room) =>
            `<button class="room-button" data-room="${room.key}">
               ${room.name}<span>${room.description}</span>
             </button>`).join("")}
        </div>
        <button class="menu__action" data-back>← Mode Select</button>
      </section>`;
    this.menuEl.querySelectorAll<HTMLButtonElement>("[data-room]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roomKey = btn.dataset.room;
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

#### Step 3 — Patch `src/game/scenes/BootScene.ts`

Find `this.scene.start("MenuScene")` and change it to `this.scene.start("ModeScene")`.

#### Step 4 — Build check + commit

```bash
npx tsc --noEmit   # must produce no errors
git add src/main.ts src/game/scenes/MenuScene.ts src/game/scenes/BootScene.ts
git commit -m "feat: wire ModeScene as entry, add LobbyScene to Phaser config"
```

---

### Tasks 8–14: GameScene Multiplayer Changes

The full detailed steps for Tasks 8–14 are in the plan file at:

```
docs/superpowers/plans/2026-04-30-multiplayer.md
```

Read that file and implement Tasks 8–14 in order. Below is a summary of what each task does so you understand the intent.

---

#### Task 8: GameScene — Types, Fields & Enemy IDs

Add these imports at the top of `GameScene.ts` (after existing imports):

```typescript
import { network } from "../net/NetworkManager";
import type { GameMode, InputKeys, LobbyPlayer, StateSnapshot } from "../net/types";
```

Add a `PlayerSprite` type (after the existing `BossSprite` type):

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

Replace the single `player` field with a `players` map and add multiplayer fields:

```typescript
// Replace:  private player!: PlayerSprite;
private players = new Map<number, PlayerSprite>();
private localPlayerId = 1;
private mode: GameMode = "solo";
private isHost = true;
private lobbyPlayers: LobbyPlayer[] = [];
private seed = 0;
private lastStateBroadcast = 0;
```

Add `enemyId` counter and `pickupId` counter:

```typescript
private nextEnemyId = 1;
private nextPickupId = 1;
```

Add `id` field to `EnemySprite` type and `PickupSprite` type (they need numeric IDs for snapshots).

Update `init()` to read the new scene data fields (`mode`, `myId`, `isHost`, `lobbyPlayers`, `seed`). Solo mode sets `myId = 1`, `isHost = true`, `lobbyPlayers = [{ id:1, name:"P1", isHost:true }]`.

Commit: `feat: add multiplayer types and fields to GameScene`

---

#### Task 9: GameScene — Multi-Player Sprite Creation

Replace the single `createPlayer()` call with `createAllPlayers()`:

```typescript
private createAllPlayers(): void {
  const TINTS = [0xffffff, 0x6ab0ff, 0x6dff8a, 0xffd76a];
  for (const lp of this.lobbyPlayers) {
    const sprite = this.createPlayerSprite(lp.id, lp.name);
    if (lp.id !== 1) sprite.setTint(TINTS[lp.id - 1] ?? 0xffffff);
    this.players.set(lp.id, sprite);
  }
}
```

Each player sprite needs a floating name label (`Phaser.GameObjects.Text`) positioned 20 px above the sprite, updated every frame in `update()`.

The local player (id === `localPlayerId`) uses the existing full-featured `createPlayer()` logic. Remote players are created as simple arcade sprites with no input or weapon logic — their positions come from snapshots.

Commit: `feat: create player sprites for all lobby players`

---

#### Task 10: GameScene — Host Simulation & State Broadcast

**In `update()`, if host:**

1. Apply local keyboard/mouse input to `players.get(localPlayerId)`
2. Drain `network.drainInputs()` and apply each relayed input to its player sprite (move + aim)
3. Run normal Phaser physics (enemies, bullets, collisions) — unchanged
4. Every 50 ms: call `broadcastState()`

```typescript
private broadcastState(): void {
  const now = this.time.now;
  if (now - this.lastStateBroadcast < 50) return;
  this.lastStateBroadcast = now;

  const snapshot: StateSnapshot = {
    wave: this.wave,
    players: [...this.players.values()].map((p) => ({
      id: p.playerId, x: p.x, y: p.y, hp: p.hp,
      aimAngle: p.aimAngle, weaponKey: p.currentWeaponKey,
      score: p.score, dead: p.dead, facingLeft: p.facingLeft,
    })),
    enemies: this.enemies.getChildren().map((e) => {
      const s = e as EnemySprite;
      return { id: s.enemyId, x: s.x, y: s.y, hp: s.hp, kind: s.kind };
    }),
    boss: this.boss
      ? { x: this.boss.x, y: this.boss.y, hp: this.boss.hp, maxHp: this.boss.maxHp }
      : null,
    pickups: this.pickups.getChildren().map((p) => {
      const s = p as PickupSprite;
      return { id: s.pickupId, x: s.x, y: s.y, kind: s.kind };
    }),
  };
  network.send({ type: "state", payload: snapshot });
}
```

**Register relay handler (in `create()`, multiplayer only):**

```typescript
network.on("input_relay", (msg) => {
  network.enqueueInput({
    playerId: msg.playerId,
    keys: msg.keys,
    aimAngle: msg.aimAngle,
    shooting: msg.shooting,
  });
});
```

Commit: `feat: host simulation loop and state broadcast`

---

#### Task 11: GameScene — Client Snapshot Rendering

**In `update()`, if non-host:**

1. Call `sendLocalInput()` every frame
2. Call `applySnapshot()` with the latest received snapshot

```typescript
private sendLocalInput(): void {
  const keys: InputKeys = {
    up: this.cursors.up.isDown || this.wasd.up.isDown,
    down: this.cursors.down.isDown || this.wasd.down.isDown,
    left: this.cursors.left.isDown || this.wasd.left.isDown,
    right: this.cursors.right.isDown || this.wasd.right.isDown,
  };
  const pointer = this.input.activePointer;
  const local = this.players.get(this.localPlayerId);
  const aimAngle = local
    ? Phaser.Math.Angle.Between(local.x, local.y, pointer.worldX, pointer.worldY)
    : 0;
  network.send({ type: "input", keys, aimAngle, shooting: pointer.isDown });
}

private latestSnapshot: StateSnapshot | null = null;

private applySnapshot(snap: StateSnapshot): void {
  this.latestSnapshot = snap;
  for (const ps of snap.players) {
    const sprite = this.players.get(ps.id);
    if (!sprite) continue;
    sprite.setPosition(ps.x, ps.y);
    sprite.hp = ps.hp;
    sprite.dead = ps.dead;
    sprite.score = ps.score;
    sprite.aimAngle = ps.aimAngle;
    sprite.facingLeft = ps.facingLeft;
    if (ps.dead) sprite.setAlpha(0.35);
  }
  // Sync enemies from snapshot (non-host: no physics, just set positions)
  // Sync boss from snapshot
  // Sync pickups from snapshot
}
```

Register the snapshot handler in `create()`:

```typescript
network.on("state", (msg) => {
  this.applySnapshot(msg as unknown as StateSnapshot);
});
```

Commit: `feat: non-host client snapshot rendering`

---

#### Task 12: GameScene — Friendly Fire

In the existing bullet–player overlap setup, gate by mode:

- **Co-op:** Only register bullet overlap with `players.get(localPlayerId)` (local player only). No overlap with remote player sprites.
- **PvP:** Register bullet overlap with ALL player sprites in the `players` map, including the local player.
- **Solo:** Unchanged (no remote players exist).

```typescript
private setupFriendlyFire(): void {
  if (this.mode === "solo") return;
  if (this.mode === "pvp") {
    for (const sprite of this.players.values()) {
      if (sprite.playerId === this.localPlayerId) continue;
      this.physics.add.overlap(this.bullets, sprite, (bullet, player) => {
        this.onBulletHitRemotePlayer(
          bullet as Phaser.Physics.Arcade.Sprite,
          player as PlayerSprite
        );
      });
    }
  }
}
```

Commit: `feat: PvP friendly fire bullet overlaps`

---

#### Task 13: GameScene — Spectator Mode & Game Over

**Spectator mode** (called when local player's HP reaches 0):

```typescript
private enterSpectatorMode(): void {
  const bar = document.querySelector("#spectator-bar");
  bar?.classList.remove("is-hidden");
  this.spectatorIndex = 0;
  this.updateSpectatorCamera();

  document.querySelector("#spectator-prev")?.addEventListener("click", () => {
    this.spectatorIndex = (this.spectatorIndex - 1 + this.alivePlayers().length)
      % this.alivePlayers().length;
    this.updateSpectatorCamera();
  });
  document.querySelector("#spectator-next")?.addEventListener("click", () => {
    this.spectatorIndex = (this.spectatorIndex + 1) % this.alivePlayers().length;
    this.updateSpectatorCamera();
  });
}

private alivePlayers(): PlayerSprite[] {
  return [...this.players.values()].filter((p) => !p.dead);
}

private updateSpectatorCamera(): void {
  const alive = this.alivePlayers();
  if (!alive.length) return;
  const target = alive[this.spectatorIndex % alive.length]!;
  document.querySelector<HTMLSpanElement>("#spectator-name")!.textContent = target.playerName;
  this.cameras.main.startFollow(target);
}
```

**Game over conditions:**

- Co-op: when ALL players in `players` map are dead → show game over
- PvP: when only one player remains alive → show winner screen

**PvP leaderboard** (`#pvp-board`): update every frame with players sorted by score, mark dead rows with class `dead`.

Commit: `feat: spectator mode, game over conditions, PvP leaderboard`

---

#### Task 14: Smoke Test & Final Cleanup

1. Run `npx tsc --noEmit` — zero errors required.
2. Run `npm run test` — all 12 tests must pass.
3. Manually test solo mode still works (pick Solo → pick a room → play normally).
4. Fix any TypeScript errors or test failures found.
5. Final commit: `chore: multiplayer smoke test cleanup`

---

## Key Design Rules (read before touching GameScene)

- **Solo must keep working unchanged.** Gate all network code behind `if (this.mode !== "solo")`.
- **Host runs full physics.** Non-host clients set positions from snapshots only — never run physics for remote players or enemies.
- **Input deduplication.** `network.enqueueInput()` keeps only the latest input per `playerId`. Safe to call every frame.
- **State broadcast at 20 Hz.** Check `time.now - lastStateBroadcast >= 50` before serialising.
- **Player color tints:**

| Slot | Tint hex |
|------|----------|
| P1 | no tint (white) |
| P2 | `0x6ab0ff` |
| P3 | `0x6dff8a` |
| P4 | `0xffd76a` |

- **Name labels:** `Phaser.GameObjects.Text` floating 20 px above each sprite, updated every frame.
- **`facingLeft`** on `PlayerSprite`: set `sprite.setFlipX(facingLeft)` when applying snapshots.

---

## Network Message Reference

### Client → Server

```jsonc
{ "type": "join",       "name": "Alice" }
{ "type": "input",      "keys": { "up": true, "down": false, "left": false, "right": true },
                         "aimAngle": 1.57, "shooting": true }
{ "type": "start_game", "roomKey": "crossfire", "mode": "coop" }
{ "type": "state",      "payload": { ...StateSnapshot } }
```

### Server → Client

```jsonc
{ "type": "assigned",     "playerId": 1, "isHost": true }
{ "type": "lobby_update", "players": [{ "id": 1, "name": "Alice", "isHost": true }] }
{ "type": "input_relay",  "playerId": 2, "keys": {...}, "aimAngle": 0.0, "shooting": false }
{ "type": "game_start",   "roomKey": "crossfire", "mode": "coop", "seed": 1735294827,
                           "players": [...] }
{ "type": "state",        ...StateSnapshot fields... }
{ "type": "player_left",  "playerId": 2 }
{ "type": "host_left" }
```

### StateSnapshot shape

```typescript
{
  wave: number;
  players: { id, x, y, hp, aimAngle, weaponKey, score, dead, facingLeft }[];
  enemies: { id, x, y, hp, kind }[];
  boss: { x, y, hp, maxHp } | null;
  pickups: { id, x, y, kind }[];
}
```

---

## Files Reference

| Path | Purpose |
|------|---------|
| `server.js` | Node.js WS relay server |
| `src/game/net/types.ts` | All network TS types |
| `src/game/net/NetworkManager.ts` | WS client + input queue |
| `src/game/scenes/ModeScene.ts` | Mode selection screen |
| `src/game/scenes/LobbyScene.ts` | Name entry + host/join UI |
| `src/game/scenes/GameScene.ts` | Main game (bulk of changes) |
| `src/main.ts` | Phaser config (register all scenes) |
| `src/game/scenes/MenuScene.ts` | Solo map select |
| `src/game/scenes/BootScene.ts` | Boot → ModeScene |
| `docs/superpowers/plans/2026-04-30-multiplayer.md` | Full step-by-step plan |
| `docs/superpowers/specs/2026-04-30-multiplayer-design.md` | Design spec |
