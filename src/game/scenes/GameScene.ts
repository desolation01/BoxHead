import Phaser from "phaser";
import { planSplitterBossDeath, SPLITTER_BOSS_MAX_KILLS, SPLITTER_BOSS_WAVE } from "../bosses";
import { getEnemy, pickEnemyForWave } from "../enemies";
import { network } from "../net/NetworkManager";
import type { GameMode, LobbyPlayer, StateSnapshot } from "../net/types";
import { chooseSmartSteerAngle } from "../pathfinding";
import { getAmmoPickupTexture, getWeaponPickupTexture } from "../pickups";
import { spawnPointFromAngle, velocityFromAngle } from "../projectiles";
import { getRoom } from "../rooms";
import type { EnemyDefinition, EnemyKind, PickupKind, RoomDefinition, WeaponKey } from "../types";
import { createWave } from "../waves";
import { getBestUnlockedWeapon, getNextUsableWeapon, getWeapon, STARTING_WEAPON, WEAPONS } from "../weapons";

type EnemySprite = Phaser.Physics.Arcade.Sprite & {
  kind: string;
  hp: number;
  reward: number;
  touchCooldown: number;
  speed: number;
  damage: number;
  touchCooldownMs: number;
  hitTexture: string;
  baseTexture: string;
  baseScale: number;
  stridePhase: number;
  lastX: number;
  lastY: number;
  stuckMs: number;
  unstuckUntil: number;
  unstuckAngle: number;
  path: Phaser.Math.Vector2[];
  pathIndex: number;
  nextPathAt: number;
  nextRangedAt: number;
  projectileTexture?: string;
  projectileDamage: number;
  projectileSpeed: number;
  projectileCooldownMs: number;
  preferredRange: number;
  deathHandled?: boolean;
  enemyId: number;
};
type BulletSprite = Phaser.Physics.Arcade.Image & {
  damage: number;
  pierce: number;
  explosiveRadius: number;
  bornAt: number;
};
type EnemyProjectileSprite = Phaser.Physics.Arcade.Image & {
  damage: number;
  bornAt: number;
};
type BarricadeSprite = Phaser.Physics.Arcade.Image & { hp: number };
type BarrelSprite = Phaser.Physics.Arcade.Image & { exploded: boolean };
type PickupSprite = Phaser.Physics.Arcade.Image & { kind: PickupKind; weaponKey?: WeaponKey; pickupId: number };
type BossSprite = EnemySprite & {
  maxHp: number;
  nextSummonAt: number;
  nextShockwaveAt: number;
  nextChargeAt: number;
  chargingUntil: number;
  isSplitterBoss?: boolean;
  splitterScale?: number;
};
type PlayerSprite = Phaser.Physics.Arcade.Sprite & {
  playerId: number;
  hp: number;
  score: number;
  dead: boolean;
  aimAngle: number;
  facingLeft: boolean;
  currentWeaponKey: WeaponKey;
  weaponImage?: Phaser.GameObjects.Image;
  nameLabel?: Phaser.GameObjects.Text;
};
type PlayerTarget = Phaser.Physics.Arcade.Sprite | PlayerSprite;
type BulletImpact = { distance: number; enemy?: EnemySprite; barrel?: BarrelSprite };

const HELD_WEAPON_TEXTURES: Record<WeaponKey, string> = {
  pistol: "player-weapon-pistol",
  magnum: "player-weapon-magnum",
  shotgun: "player-weapon-shotgun",
  ak47: "player-weapon-ak47",
  uzi: "player-weapon-uzi",
  crossbow: "player-weapon-crossbow",
  flameBurst: "player-weapon-flameBurst",
  barrelLauncher: "player-weapon-barrelLauncher",
  railBurst: "player-weapon-railBurst",
  minigun: "player-weapon-minigun"
};

interface GridCell {
  x: number;
  y: number;
}

interface GameSceneData {
  roomKey: string;
  mode?: GameMode;
  myId?: number;
  isHost?: boolean;
  players?: LobbyPlayer[];
  seed?: number;
}

type TouchStickState = {
  pointerId: number | null;
  vector: Phaser.Math.Vector2;
  knob: HTMLElement | null;
};

const PLAYER_TINTS = [undefined, 0x6ab0ff, 0x6dff8a, 0xffd76a] as const;
const STARTING_WAVE = 1;

export class GameScene extends Phaser.Scene {
  private room!: RoomDefinition;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerWeapon!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private barricades!: Phaser.Physics.Arcade.Group;
  private barrels!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private remotePlayers = new Map<number, PlayerSprite>();
  private lobbyPlayers: LobbyPlayer[] = [];
  private gameMode: GameMode = "solo";
  private myId = 1;
  private isHost = true;
  private latestSnapshot: StateSnapshot | null = null;
  private lastBroadcastAt = 0;
  private nextEnemyId = 1;
  private nextPickupId = 1;
  private spectating = false;
  private spectatorTargets: number[] = [];
  private spectatorIndex = 0;
  private spectatorBarEl: HTMLElement | null = null;
  private spectatorNameEl: HTMLElement | null = null;
  private pvpBoardEl: HTMLElement | null = null;
  private hudEl: HTMLElement | null = null;
  private bossHudEl: HTMLElement | null = null;
  private bossHpFillEl: HTMLElement | null = null;
  private menuEl: HTMLElement | null = null;
  private touchControlsEl: HTMLElement | null = null;
  private orientationLockEl: HTMLElement | null = null;
  private touchMoveStick: TouchStickState = { pointerId: null, vector: new Phaser.Math.Vector2(), knob: null };
  private touchAimStick: TouchStickState = { pointerId: null, vector: new Phaser.Math.Vector2(), knob: null };
  private touchShooting = false;
  private touchWeaponQueued = false;
  private orientationBlocked = false;
  private orientationPausedPhysics = false;
  private removeTouchControlListeners: Array<() => void> = [];
  private health = 100;
  private score = 0;
  private waveNumber = STARTING_WAVE;
  private currentWeapon = STARTING_WEAPON;
  private ammo = new Map<WeaponKey, number>();
  private lastShotAt = 0;
  private aimAngle = 0;
  private facingDirection: -1 | 1 = 1;
  private weaponRecoil = 0;
  private enemiesQueued = 0;
  private enemiesAlive = 0;
  private nextSpawnAt = 0;
  private boss: BossSprite | null = null;
  private bossWave = false;
  private splitterBossWave = false;
  private splitterBossSpawned = 0;
  private splitterBossKilled = 0;
  private gameOver = false;
  private readonly navCellSize = 48;
  private navCols = 0;
  private navRows = 0;
  private staticBlockedCells = new Set<string>();

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    this.room = getRoom(data.roomKey ?? "crossfire");
    this.gameMode = data.mode ?? "solo";
    this.myId = data.myId ?? 1;
    this.isHost = data.isHost ?? true;
    this.lobbyPlayers = data.players ?? [{ id: 1, name: "Player", isHost: true }];
  }

  create(): void {
    this.resetRunState();
    this.createWorld();
    this.createPlayer();
    this.createRemotePlayers();
    this.createInput();
    this.configureNetworkHandlers();
    this.createCollisions();
    this.startWave(STARTING_WAVE);
    this.hudEl = document.querySelector("#hud");
    this.menuEl = document.querySelector("#menu");
    this.spectatorBarEl = document.querySelector("#spectator-bar");
    this.spectatorNameEl = document.querySelector("#spectator-name");
    this.pvpBoardEl = document.querySelector("#pvp-board");
    this.touchControlsEl = document.querySelector("#touch-controls");
    this.orientationLockEl = document.querySelector("#orientation-lock");
    this.menuEl?.classList.add("is-hidden");
    this.spectatorBarEl?.classList.add("is-hidden");
    this.pvpBoardEl?.classList.add("is-hidden");
    this.touchControlsEl?.classList.remove("is-hidden");
    this.hudEl?.classList.remove("is-hidden");
    this.applyResponsiveCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyResponsiveCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyResponsiveCamera, this);
    });
    this.updateOrientationLock();
    this.updateHud();
  }

  update(time: number, delta: number): void {
    if (this.gameOver) return;
    if (this.orientationBlocked) return;

    this.applyPendingSnapshot();

    if (this.spectating) {
      this.handleSpectatorControls();
      this.updatePvpBoard();
    }

    if (this.spectating && (!this.isHost || this.gameMode === "solo")) {
      return;
    }

    if (!this.spectating) {
      this.updatePlayer();
      this.updateAiming();
      this.updateWeaponKeys();
      this.handleShooting(time);
      if (!this.isHost && this.gameMode !== "solo") {
        this.sendLocalInput();
      }
    }

    if (this.isHost || this.gameMode === "solo") {
      this.applyRemoteInputs(time);
      this.updateEnemies(delta);
      this.updateBoss(time);
      this.updateSpawning(time);
    }
    this.cleanupBullets(time);
    this.cleanupEnemyProjectiles(time);
    if (this.isHost || this.gameMode === "solo") {
      this.checkWaveClear(time);
    }
    this.updateHud();
    this.updatePlayerLabels();
    this.updatePvpBoard();
    if (this.isHost && this.gameMode !== "solo" && time - this.lastBroadcastAt >= 50) {
      this.lastBroadcastAt = time;
      this.broadcastState();
    }
  }

  private handleSpectatorControls(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.COMMA)) this.prevSpectatorTarget();
    if (Phaser.Input.Keyboard.JustDown(this.keys.PERIOD)) this.nextSpectatorTarget();
  }

  private resetRunState(): void {
    this.physics.resume();
    this.health = 100;
    this.score = 0;
    this.waveNumber = STARTING_WAVE;
    this.currentWeapon = STARTING_WEAPON;
    this.lastShotAt = 0;
    this.aimAngle = 0;
    this.facingDirection = 1;
    this.weaponRecoil = 0;
    this.enemiesQueued = 0;
    this.enemiesAlive = 0;
    this.nextSpawnAt = 0;
    this.boss = null;
    this.bossWave = false;
    this.splitterBossWave = false;
    this.splitterBossSpawned = 0;
    this.splitterBossKilled = 0;
    this.gameOver = false;
    this.remotePlayers.clear();
    this.latestSnapshot = null;
    this.lastBroadcastAt = 0;
    this.nextEnemyId = 1;
    this.nextPickupId = 1;
    this.spectating = false;
    this.spectatorTargets = [];
    this.spectatorIndex = 0;
    this.orientationBlocked = false;
    this.orientationPausedPhysics = false;
    this.resetTouchControls();
    this.ammo = new Map(WEAPONS.map((weapon) => [weapon.key, 0]));
  }

  private createWorld(): void {
    this.physics.world.setBounds(0, 0, this.room.width, this.room.height);
    this.cameras.main.setBounds(0, 0, this.room.width, this.room.height);
    this.add.tileSprite(this.room.width / 2, this.room.height / 2, this.room.width, this.room.height, "floor-tile").setDepth(0);
    this.add.grid(this.room.width / 2, this.room.height / 2, this.room.width, this.room.height, 64, 64, 0x000000, 0, 0x141410, 0.5).setDepth(0.05);
    this.createRoomDressing();

    this.walls = this.physics.add.staticGroup();
    for (const wall of this.room.walls) {
      this.add.rectangle(wall.x + wall.width / 2 + 4, wall.y + wall.height / 2 + 5, wall.width, wall.height, 0x050504, 0.28).setDepth(0.55);
      const tile = this.add.tileSprite(wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width, wall.height, "wall");
      tile.setDepth(1);
      this.physics.add.existing(tile, true);
      this.walls.add(tile);
    }

    this.barricades = this.physics.add.group({ immovable: true });
    for (const barricade of this.room.barricades) {
      const sprite = this.physics.add.image(barricade.x + barricade.width / 2, barricade.y + barricade.height / 2, "barricade") as BarricadeSprite;
      sprite.setDisplaySize(barricade.width, barricade.height);
      sprite.refreshBody();
      sprite.setImmovable(true);
      sprite.setDepth(2);
      sprite.hp = 7;
      this.barricades.add(sprite);
    }

    this.barrels = this.physics.add.group({ immovable: true });
    for (const barrel of this.room.barrels) {
      const sprite = this.physics.add.image(barrel.x, barrel.y, "barrel") as BarrelSprite;
      sprite.setImmovable(true);
      sprite.setDepth(2);
      sprite.exploded = false;
      this.barrels.add(sprite);
    }

    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.buildNavigationGrid();
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(this.room.playerStart.x, this.room.playerStart.y, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    this.player.setMaxVelocity(220);
    this.player.setDepth(4);
    this.player.body!.setSize(30, 28);
    this.player.body!.setOffset(11, 7);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.applyResponsiveCamera();
    this.playerWeapon = this.add.image(this.player.x, this.player.y, HELD_WEAPON_TEXTURES[this.currentWeapon.key]);
    this.playerWeapon.setOrigin(0.15, 0.5);
    this.playerWeapon.setDepth(4.4);
  }

  private applyResponsiveCamera(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const isMobileViewport = width <= 760 || height <= 520;
    const isPortrait = height > width;
    const zoom = isMobileViewport ? (isPortrait ? 1.25 : 1.34) : 1;
    const deadzoneWidth = isMobileViewport ? Math.min(150, width * 0.24) : 180;
    const deadzoneHeight = isMobileViewport ? Math.min(72, height * 0.16) : 120;

    this.cameras.main.setZoom(zoom);
    this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);
    this.updateOrientationLock();
  }

  private updateOrientationLock(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const shouldBlock = this.isMobileViewport() && height > width;
    this.orientationBlocked = shouldBlock;
    this.orientationLockEl?.classList.toggle("is-hidden", !shouldBlock);
    this.orientationLockEl?.setAttribute("aria-hidden", shouldBlock ? "false" : "true");
    this.touchControlsEl?.classList.toggle("is-hidden", shouldBlock || this.gameOver || this.spectating);
    this.hudEl?.classList.toggle("is-orientation-blocked", shouldBlock);
    this.bossHudEl?.classList.toggle("is-orientation-blocked", shouldBlock);

    if (shouldBlock) {
      this.resetTouchControls();
      this.player?.setVelocity(0, 0);
      if (!this.orientationPausedPhysics) {
        this.physics.pause();
        this.orientationPausedPhysics = true;
      }
    } else if (this.orientationPausedPhysics && !this.gameOver) {
      this.physics.resume();
      this.orientationPausedPhysics = false;
    }
  }

  private isMobileViewport(): boolean {
    return this.scale.width <= 760 || this.scale.height <= 520 || window.matchMedia("(pointer: coarse)").matches;
  }

  private createRemotePlayers(): void {
    if (this.gameMode === "solo") return;

    const startOffsets = [
      { x: 0, y: 0 },
      { x: 34, y: 0 },
      { x: -34, y: 0 },
      { x: 0, y: 34 }
    ];

    this.lobbyPlayers.forEach((player, index) => {
      if (player.id === this.myId) return;
      const offset = startOffsets[index] ?? { x: 0, y: 0 };
      const sprite = this.physics.add.sprite(this.room.playerStart.x + offset.x, this.room.playerStart.y + offset.y, "player") as PlayerSprite;
      sprite.playerId = player.id;
      sprite.hp = 100;
      sprite.score = 0;
      sprite.dead = false;
      sprite.aimAngle = 0;
      sprite.facingLeft = false;
      sprite.currentWeaponKey = STARTING_WEAPON.key;
      sprite.setDepth(4);
      sprite.setDrag(900, 900);
      sprite.setMaxVelocity(220);
      sprite.body!.setSize(30, 28);
      sprite.body!.setOffset(11, 7);
      const tint = PLAYER_TINTS[index];
      if (tint) sprite.setTint(tint);
      sprite.weaponImage = this.add.image(sprite.x, sprite.y, HELD_WEAPON_TEXTURES.pistol).setOrigin(0.15, 0.5).setDepth(4.4);
      sprite.nameLabel = this.add.text(sprite.x, sprite.y - 32, player.name, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#f4ecd2",
        stroke: "#000000",
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6);
      this.remotePlayers.set(player.id, sprite);
      this.physics.add.collider(sprite, this.walls);
      this.physics.add.collider(sprite, this.barricades);
    });
  }

  private configureNetworkHandlers(): void {
    if (this.gameMode === "solo") return;

    network.on("input_relay", (msg) => network.enqueueInput(msg));
    network.on("state", (msg) => {
      this.latestSnapshot = {
        wave: msg.wave,
        players: msg.players,
        enemies: msg.enemies,
        boss: msg.boss,
        pickups: msg.pickups
      };
    });
    network.on("player_left", (msg) => {
      const sprite = this.remotePlayers.get(msg.playerId);
      sprite?.weaponImage?.destroy();
      sprite?.nameLabel?.destroy();
      sprite?.destroy();
      this.remotePlayers.delete(msg.playerId);
      this.lobbyPlayers = this.lobbyPlayers.filter((player) => player.id !== msg.playerId);
    });
    network.on("host_left", () => {
      this.showHostLeftMessage();
    });
  }

  private createInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,Q,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,ZERO,ESC,COMMA,PERIOD") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.createTouchControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyTouchControls();
    });
  }

  private createTouchControls(): void {
    this.destroyTouchControls();
    const controls = document.querySelector<HTMLElement>("#touch-controls");
    const move = controls?.querySelector<HTMLElement>("[data-touch-move]") ?? null;
    const aim = controls?.querySelector<HTMLElement>("[data-touch-aim]") ?? null;
    const weapon = controls?.querySelector<HTMLButtonElement>("[data-touch-weapon]") ?? null;
    this.touchControlsEl = controls ?? null;
    this.touchMoveStick.knob = controls?.querySelector<HTMLElement>("[data-touch-move-knob]") ?? null;
    this.touchAimStick.knob = controls?.querySelector<HTMLElement>("[data-touch-aim-knob]") ?? null;

    if (!controls || !move || !aim || !weapon) return;

    this.bindTouchStick(move, this.touchMoveStick, false);
    this.bindTouchStick(aim, this.touchAimStick, true);

    const queueWeapon = (event: PointerEvent) => {
      event.preventDefault();
      this.touchWeaponQueued = true;
    };
    weapon.addEventListener("pointerdown", queueWeapon);
    this.removeTouchControlListeners.push(() => weapon.removeEventListener("pointerdown", queueWeapon));
  }

  private bindTouchStick(element: HTMLElement, stick: TouchStickState, shoots: boolean): void {
    const start = (event: PointerEvent) => {
      event.preventDefault();
      stick.pointerId = event.pointerId;
      element.setPointerCapture(event.pointerId);
      if (shoots) this.touchShooting = true;
      this.updateTouchStickFromEvent(element, stick, event);
    };
    const move = (event: PointerEvent) => {
      if (stick.pointerId !== event.pointerId) return;
      event.preventDefault();
      this.updateTouchStickFromEvent(element, stick, event);
    };
    const end = (event: PointerEvent) => {
      if (stick.pointerId !== event.pointerId) return;
      event.preventDefault();
      stick.pointerId = null;
      stick.vector.set(0, 0);
      this.updateTouchKnob(stick);
      if (shoots) this.touchShooting = false;
    };

    element.addEventListener("pointerdown", start);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    this.removeTouchControlListeners.push(
      () => element.removeEventListener("pointerdown", start),
      () => element.removeEventListener("pointermove", move),
      () => element.removeEventListener("pointerup", end),
      () => element.removeEventListener("pointercancel", end)
    );
  }

  private updateTouchStickFromEvent(element: HTMLElement, stick: TouchStickState, event: PointerEvent): void {
    const rect = element.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const vector = new Phaser.Math.Vector2(x / radius, y / radius);
    if (vector.lengthSq() > 1) vector.normalize();
    stick.vector.copy(vector);
    this.updateTouchKnob(stick);
  }

  private updateTouchKnob(stick: TouchStickState): void {
    const distance = 28;
    stick.knob?.style.setProperty("--knob-x", `${Math.round(stick.vector.x * distance)}px`);
    stick.knob?.style.setProperty("--knob-y", `${Math.round(stick.vector.y * distance)}px`);
  }

  private destroyTouchControls(): void {
    for (const remove of this.removeTouchControlListeners) remove();
    this.removeTouchControlListeners = [];
    this.resetTouchControls();
    this.touchControlsEl?.classList.add("is-hidden");
  }

  private resetTouchControls(): void {
    this.touchMoveStick.pointerId = null;
    this.touchMoveStick.vector.set(0, 0);
    this.touchAimStick.pointerId = null;
    this.touchAimStick.vector.set(0, 0);
    this.touchShooting = false;
    this.touchWeaponQueued = false;
    this.updateTouchKnob(this.touchMoveStick);
    this.updateTouchKnob(this.touchAimStick);
  }

  private createCollisions(): void {
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.barricades);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.enemies, this.barricades, (enemy, barricade) => {
      this.damageBarricade(enemy as EnemySprite, barricade as BarricadeSprite);
    });
    this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
      this.hitEnemy(bullet as BulletSprite, enemy as EnemySprite);
    });
    this.physics.add.overlap(this.bullets, this.barrels, (bullet, barrel) => {
      this.explodeBarrel(barrel as BarrelSprite);
      bullet.destroy();
    });
    this.physics.add.collider(this.bullets, this.walls, (bullet) => bullet.destroy());
    this.physics.add.collider(this.bullets, this.barricades, (bullet) => bullet.destroy());
    this.physics.add.collider(this.enemyProjectiles, this.walls, (projectile) => projectile.destroy());
    this.physics.add.collider(this.enemyProjectiles, this.barricades, (projectile) => projectile.destroy());
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_player, projectile) => {
      this.hitPlayerWithEnemyProjectile(projectile as EnemyProjectileSprite);
    });
    this.physics.add.overlap(this.player, this.pickups, (_player, pickup) => this.collectPickup(pickup as PickupSprite));
    for (const sprite of this.remotePlayers.values()) {
      this.physics.add.overlap(this.enemyProjectiles, sprite, (_remote, projectile) => {
        this.hitPlayerWithEnemyProjectile(projectile as EnemyProjectileSprite, sprite);
      });
    }
    if (this.gameMode === "pvp") {
      for (const sprite of this.remotePlayers.values()) {
        this.physics.add.overlap(this.bullets, sprite, (bullet) => {
          const b = bullet as BulletSprite;
          if (sprite.dead) return;
          sprite.hp = Math.max(0, sprite.hp - b.damage);
          b.destroy();
          if (sprite.hp <= 0) this.killRemotePlayer(sprite);
        });
      }
    }
  }

  private startWave(wave: number): void {
    const definition = createWave(wave);
    this.waveNumber = definition.wave;
    this.bossWave = definition.wave % 5 === 0;
    this.splitterBossWave = definition.wave === SPLITTER_BOSS_WAVE;
    this.splitterBossSpawned = 0;
    this.splitterBossKilled = 0;
    this.enemiesQueued = this.bossWave ? Math.ceil(definition.enemyCount * 0.45) : definition.enemyCount;
    this.enemiesAlive = 0;
    this.nextSpawnAt = this.time.now + 700;
    this.boss = null;
    this.updateBossHud();
    if (this.bossWave) {
      this.time.delayedCall(800, () => {
        if (this.splitterBossWave) this.spawnSplitterBoss(definition);
        else this.spawnBoss(definition);
      });
    }
  }

  private updatePlayer(): void {
    const velocity = this.getMovementVector();

    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(218);
      if (Math.abs(velocity.x) > 8) {
        this.facingDirection = velocity.x < 0 ? -1 : 1;
      }
    }
    this.player.setVelocity(velocity.x, velocity.y);

    const moveRatio = Phaser.Math.Clamp(velocity.length() / 218, 0, 1);
    const bob = Math.sin(this.time.now * 0.015) * 0.05 * moveRatio;
    this.player.setScale(1 - bob, 1 + bob);
    this.player.setFlipX(this.facingDirection < 0);
  }

  private getMovementVector(): Phaser.Math.Vector2 {
    const left = this.keys.A.isDown || this.cursors.left?.isDown;
    const right = this.keys.D.isDown || this.cursors.right?.isDown;
    const up = this.keys.W.isDown || this.cursors.up?.isDown;
    const down = this.keys.S.isDown || this.cursors.down?.isDown;
    return new Phaser.Math.Vector2(
      Number(right) - Number(left) + this.touchMoveStick.vector.x,
      Number(down) - Number(up) + this.touchMoveStick.vector.y
    );
  }

  private updateAiming(): void {
    if (this.touchAimStick.vector.lengthSq() > 0.03) {
      this.aimAngle = Math.atan2(this.touchAimStick.vector.y, this.touchAimStick.vector.x);
    } else if (!this.isTouchControlActive()) {
      const pointer = this.getPointerWorldPoint();
      this.aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);
    }
    if (Math.abs(this.player.body!.velocity.x) <= 8) {
      this.facingDirection = Math.cos(this.aimAngle) < 0 ? -1 : 1;
    }
    this.player.setRotation(0);
    this.player.setFlipX(this.facingDirection < 0);
    this.playerWeapon.setPosition(this.player.x, this.player.y);
    this.playerWeapon.setRotation(this.aimAngle);
    this.weaponRecoil = Phaser.Math.Linear(this.weaponRecoil, 0, 0.22);
    this.playerWeapon.setScale(1 - this.weaponRecoil * 0.08, 1 + this.weaponRecoil * 0.04);
    this.playerWeapon.setX(this.playerWeapon.x - Math.cos(this.aimAngle) * this.weaponRecoil * 6);
    this.playerWeapon.setY(this.playerWeapon.y - Math.sin(this.aimAngle) * this.weaponRecoil * 6);
  }

  private updateWeaponKeys(): void {
    const keyMap: Array<[string, WeaponKey]> = [
      ["ONE", "pistol"],
      ["TWO", "magnum"],
      ["THREE", "shotgun"],
      ["FOUR", "ak47"],
      ["FIVE", "uzi"],
      ["SIX", "crossbow"],
      ["SEVEN", "flameBurst"],
      ["EIGHT", "barrelLauncher"],
      ["NINE", "railBurst"],
      ["ZERO", "minigun"]
    ];

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q) || this.consumeTouchWeaponQueued()) {
      this.equipWeapon(getNextUsableWeapon(this.currentWeapon.key, this.score, (key) => this.ammo.get(key) ?? 0));
      return;
    }

    for (const [key, weaponKey] of keyMap) {
      if (!Phaser.Input.Keyboard.JustDown(this.keys[key])) continue;
      const weapon = getWeapon(weaponKey);
      if (this.score >= weapon.unlockScore && (weapon.key === "pistol" || (this.ammo.get(weapon.key) ?? 0) > 0)) {
        this.equipWeapon(weapon);
      }
    }
  }

  private equipWeapon(weapon: typeof STARTING_WEAPON): void {
    this.currentWeapon = weapon;
    this.playerWeapon.setTexture(HELD_WEAPON_TEXTURES[weapon.key]);
  }

  private handleShooting(time: number): void {
    if (!this.isShootingPressed()) return;
    if (time - this.lastShotAt < this.currentWeapon.fireRateMs) return;
    const weaponAmmo = this.ammo.get(this.currentWeapon.key) ?? 0;
    if (weaponAmmo < this.currentWeapon.ammoPerShot) return;

    this.lastShotAt = time;
    if (this.currentWeapon.ammoPerShot > 0) {
      this.ammo.set(this.currentWeapon.key, Math.max(0, weaponAmmo - this.currentWeapon.ammoPerShot));
    }

    const baseAngle = this.aimAngle;
    const pelletCount = this.currentWeapon.pellets;
    for (let index = 0; index < pelletCount; index += 1) {
      const offset = pelletCount === 1 ? 0 : Phaser.Math.Linear(-this.currentWeapon.spread, this.currentWeapon.spread, index / (pelletCount - 1));
      this.spawnBullet(baseAngle + offset);
    }
    this.weaponRecoil = 1;
    this.tweens.add({
      targets: this.player,
      scaleX: 0.96,
      scaleY: 1.04,
      duration: 55,
      yoyo: true
    });
    this.cameras.main.shake(45, 0.0025);
  }

  private applyRemoteInputs(time: number): void {
    if (this.gameMode === "solo") return;

    for (const input of network.drainInputs()) {
      const sprite = this.remotePlayers.get(input.playerId);
      if (!sprite || sprite.dead) continue;
      const velocity = new Phaser.Math.Vector2(Number(input.keys.right) - Number(input.keys.left), Number(input.keys.down) - Number(input.keys.up));
      if (velocity.lengthSq() > 0) velocity.normalize().scale(218);
      sprite.setVelocity(velocity.x, velocity.y);
      sprite.aimAngle = input.aimAngle;
      if (input.weaponKey && input.weaponKey in HELD_WEAPON_TEXTURES) {
        sprite.currentWeaponKey = input.weaponKey as WeaponKey;
      }
      sprite.facingLeft = velocity.x < -8 || (Math.abs(velocity.x) <= 8 && Math.cos(input.aimAngle) < 0);
      sprite.setFlipX(sprite.facingLeft);
      sprite.weaponImage?.setPosition(sprite.x, sprite.y);
      sprite.weaponImage?.setRotation(input.aimAngle);
      sprite.weaponImage?.setTexture(HELD_WEAPON_TEXTURES[sprite.currentWeaponKey]);
      if (input.shooting) this.fireRemoteWeapon(sprite, time);
    }
  }

  private fireRemoteWeapon(sprite: PlayerSprite, now: number): void {
    const weapon = getWeapon(sprite.currentWeaponKey);
    const lastShotAt = (sprite.getData("lastShotAt") as number | undefined) ?? 0;
    if (now - lastShotAt < weapon.fireRateMs) return;
    sprite.setData("lastShotAt", now);

    const pelletCount = weapon.pellets;
    for (let index = 0; index < pelletCount; index += 1) {
      const offset = pelletCount === 1 ? 0 : Phaser.Math.Linear(-weapon.spread, weapon.spread, index / (pelletCount - 1));
      const angle = sprite.aimAngle + offset;
      const spawn = spawnPointFromAngle(sprite, angle, 42);
      const velocity = velocityFromAngle(angle, weapon.bulletSpeed);
      const bullet = this.bullets.create(spawn.x, spawn.y, "bullet") as BulletSprite;
      bullet.setTint(weapon.color);
      bullet.setRotation(angle);
      bullet.setDepth(5);
      bullet.setActive(true).setVisible(true);
      bullet.body!.enable = true;
      bullet.setVelocity(velocity.x, velocity.y);
      bullet.damage = weapon.damage;
      bullet.pierce = weapon.pierce ?? 0;
      bullet.explosiveRadius = weapon.explosiveRadius ?? weapon.flameRadius ?? 0;
      bullet.bornAt = now;
      this.resolveRemoteBulletImpact(bullet, angle, 920);
    }
  }

  private resolveRemoteBulletImpact(bullet: BulletSprite, angle: number, range: number): void {
    const impact = this.getFirstBulletImpact(bullet.x, bullet.y, angle, range);
    if (!impact) return;

    if (impact.barrel) {
      this.explodeBarrel(impact.barrel);
      bullet.destroy();
      return;
    }

    if (impact.enemy) {
      this.hitEnemy(bullet, impact.enemy);
    }
  }

  private getFirstBulletImpact(x: number, y: number, angle: number, range: number): BulletImpact | null {
    let first: BulletImpact | null = null;

    for (const barrel of this.barrels.getChildren() as BarrelSprite[]) {
      if (!barrel.active || barrel.exploded) continue;
      const distance = this.getRayCircleImpactDistance(x, y, angle, barrel.x, barrel.y, 18, range);
      if (distance === null || !this.hasClearPath(x, y, barrel.x, barrel.y)) continue;
      if (!first || distance < first.distance) first = { distance, barrel };
    }

    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      if (!enemy.active) continue;
      const distance = this.getRayCircleImpactDistance(x, y, angle, enemy.x, enemy.y, enemy === this.boss ? 34 : 22, range);
      if (distance === null || !this.hasClearPath(x, y, enemy.x, enemy.y)) continue;
      if (!first || distance < first.distance) first = { distance, enemy };
    }

    return first;
  }

  private getRayCircleImpactDistance(
    rayX: number,
    rayY: number,
    angle: number,
    targetX: number,
    targetY: number,
    radius: number,
    range: number
  ): number | null {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const toTargetX = targetX - rayX;
    const toTargetY = targetY - rayY;
    const projection = toTargetX * dx + toTargetY * dy;
    if (projection < 0 || projection > range) return null;

    const closestX = rayX + dx * projection;
    const closestY = rayY + dy * projection;
    const missDistance = Phaser.Math.Distance.Between(closestX, closestY, targetX, targetY);
    return missDistance <= radius ? Math.max(0, projection - radius) : null;
  }

  private sendLocalInput(): void {
    const movement = this.getMovementVector();
    network.send({
      type: "input",
      keys: {
        up: movement.y < -0.2,
        down: movement.y > 0.2,
        left: movement.x < -0.2,
        right: movement.x > 0.2
      },
      aimAngle: this.aimAngle,
      shooting: this.isShootingPressed(),
      weaponKey: this.currentWeapon.key
    });
  }

  private isShootingPressed(): boolean {
    return this.touchShooting || this.keys.SPACE.isDown || (this.input.activePointer.isDown && !this.isTouchControlActive());
  }

  private isTouchControlActive(): boolean {
    return this.touchMoveStick.pointerId !== null || this.touchAimStick.pointerId !== null;
  }

  private consumeTouchWeaponQueued(): boolean {
    const queued = this.touchWeaponQueued;
    this.touchWeaponQueued = false;
    return queued;
  }

  private spawnBullet(angle: number): void {
    const spawn = spawnPointFromAngle(this.player, angle, 42);
    const velocity = velocityFromAngle(angle, this.currentWeapon.bulletSpeed);
    const bullet = this.bullets.create(spawn.x, spawn.y, "bullet") as BulletSprite;
    bullet.setTint(this.currentWeapon.color);
    bullet.setRotation(angle);
    bullet.setDepth(5);
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.body!.enable = true;
    bullet.setVelocity(velocity.x, velocity.y);
    bullet.damage = this.currentWeapon.damage;
    bullet.pierce = this.currentWeapon.pierce ?? 0;
    bullet.explosiveRadius = this.currentWeapon.explosiveRadius ?? 0;
    if (this.currentWeapon.flameRadius) {
      bullet.explosiveRadius = this.currentWeapon.flameRadius;
    }
    bullet.bornAt = this.time.now;
    this.spawnMuzzleFlash(angle);
  }

  private getPointerWorldPoint(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      if (!enemy.active) continue;
      const touchTarget = this.getNearestLivingPlayer(enemy.x, enemy.y);
      const rangedReady = this.updateRangedEnemy(enemy);
      if (!rangedReady && (enemy !== this.boss || this.boss.chargingUntil <= this.time.now)) {
        this.navigateEnemy(enemy, delta);
      }

      enemy.stridePhase += delta * 0.012 * Phaser.Math.Clamp(enemy.speed / 100, 0.7, 1.8);
      enemy.setScale(enemy.scaleX, 1 + Math.sin(enemy.stridePhase) * 0.06);

      if (touchTarget && Phaser.Math.Distance.Between(enemy.x, enemy.y, touchTarget.x, touchTarget.y) < 32) {
        enemy.touchCooldown -= delta;
        if (enemy.touchCooldown <= 0) {
          enemy.touchCooldown = enemy.touchCooldownMs;
          this.tweens.add({ targets: enemy, scaleX: 1.12, scaleY: 0.88, yoyo: true, duration: 90 });
          this.damagePlayerTarget(touchTarget, enemy.damage);
        }
      }
    }
  }

  private updateRangedEnemy(enemy: EnemySprite): boolean {
    if (!enemy.projectileTexture || enemy === this.boss) return false;

    const target = this.getNearestLivingPlayer(enemy.x, enemy.y);
    if (!target) return false;

    const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
    const hasShot = distance <= enemy.preferredRange && this.hasClearPath(enemy.x, enemy.y, target.x, target.y);
    if (!hasShot) return false;

    enemy.setVelocity(0, 0);
    if (this.time.now < enemy.nextRangedAt) return true;

    enemy.nextRangedAt = this.time.now + enemy.projectileCooldownMs + Phaser.Math.Between(-180, 220);
    this.tweens.add({ targets: enemy, scaleX: enemy.scaleX * 0.88, scaleY: enemy.scaleY * 1.14, yoyo: true, duration: 115 });
    this.time.delayedCall(150, () => {
      if (enemy.active && !this.gameOver) {
        this.spawnEnemyProjectile(enemy);
      }
    });
    return true;
  }

  private spawnEnemyProjectile(enemy: EnemySprite): void {
    if (!enemy.projectileTexture) return;

    const target = this.getNearestLivingPlayer(enemy.x, enemy.y);
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);
    const spawn = spawnPointFromAngle(enemy, angle, 28);
    const velocity = velocityFromAngle(angle, enemy.projectileSpeed);
    const projectile = this.enemyProjectiles.create(spawn.x, spawn.y, enemy.projectileTexture) as EnemyProjectileSprite;
    projectile.damage = enemy.projectileDamage;
    projectile.bornAt = this.time.now;
    projectile.setDepth(4.8);
    projectile.setRotation(angle);
    projectile.setVelocity(velocity.x, velocity.y);
    projectile.setCircle(7);
  }

  private navigateEnemy(enemy: EnemySprite, delta: number): void {
    const targetPlayer = this.getNearestLivingPlayer(enemy.x, enemy.y);
    if (!targetPlayer) {
      enemy.setVelocity(0, 0);
      return;
    }

    const canChaseDirectly = this.hasClearPath(enemy.x, enemy.y, targetPlayer.x, targetPlayer.y);
    let target = new Phaser.Math.Vector2(targetPlayer.x, targetPlayer.y);

    if (!canChaseDirectly) {
      if (this.time.now >= enemy.nextPathAt || enemy.path.length === 0 || enemy.stuckMs > 180) {
        enemy.path = this.findPath(enemy.x, enemy.y, targetPlayer.x, targetPlayer.y);
        enemy.pathIndex = 0;
        enemy.nextPathAt = this.time.now + Phaser.Math.Between(240, 420);
      }

      const waypoint = enemy.path[enemy.pathIndex];
      if (waypoint) {
        target = waypoint;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, waypoint.x, waypoint.y) < 18) {
          enemy.pathIndex += 1;
        }
      }
    } else {
      enemy.path = [];
      enemy.pathIndex = 0;
    }

    const moved = Phaser.Math.Distance.Between(enemy.x, enemy.y, enemy.lastX, enemy.lastY);
    if (moved < 2.2 && Phaser.Math.Distance.Between(enemy.x, enemy.y, targetPlayer.x, targetPlayer.y) > 50) {
      enemy.stuckMs += delta;
    } else {
      enemy.stuckMs = Math.max(0, enemy.stuckMs - delta * 2.4);
    }
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;

    if (enemy.stuckMs > 420) {
      enemy.stuckMs = 0;
      enemy.unstuckUntil = this.time.now + 650;
      enemy.unstuckAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y) + Phaser.Math.FloatBetween(-1.0, 1.0);
      enemy.path = [];
    }

    let steerAngle = chooseSmartSteerAngle({
      from: { x: enemy.x, y: enemy.y },
      target,
      obstacles: this.getNavigationObstacles().map((rect) => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })),
      probeDistance: 70
    });
    if (this.time.now < enemy.unstuckUntil) {
      steerAngle = chooseSmartSteerAngle({
        from: { x: enemy.x, y: enemy.y },
        target: {
          x: enemy.x + Math.cos(enemy.unstuckAngle) * 90,
          y: enemy.y + Math.sin(enemy.unstuckAngle) * 90
        },
        obstacles: this.getNavigationObstacles().map((rect) => ({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        })),
        probeDistance: 70
      });
    }

    const velocity = velocityFromAngle(steerAngle, enemy.speed);
    enemy.setVelocity(velocity.x, velocity.y);
  }

  private buildNavigationGrid(): void {
    this.navCols = Math.ceil(this.room.width / this.navCellSize);
    this.navRows = Math.ceil(this.room.height / this.navCellSize);
    this.staticBlockedCells.clear();

    for (let y = 0; y < this.navRows; y += 1) {
      for (let x = 0; x < this.navCols; x += 1) {
        if (this.room.walls.some((wall) => this.cellOverlapsRect({ x, y }, wall, 10))) {
          this.staticBlockedCells.add(this.cellKey(x, y));
        }
      }
    }
  }

  private findPath(fromX: number, fromY: number, toX: number, toY: number): Phaser.Math.Vector2[] {
    const start = this.findNearestOpenCell(this.worldToCell(fromX, fromY));
    const goal = this.findNearestOpenCell(this.worldToCell(toX, toY));
    if (!start || !goal) return [];

    const open = new Set<string>([this.cellKey(start.x, start.y)]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[this.cellKey(start.x, start.y), 0]]);
    const fScore = new Map<string, number>([[this.cellKey(start.x, start.y), this.cellDistance(start, goal)]]);
    let guard = 0;

    while (open.size > 0 && guard < 900) {
      guard += 1;
      const currentKey = [...open].reduce((best, key) => (this.mapScore(fScore, key) < this.mapScore(fScore, best) ? key : best));
      const current = this.parseCellKey(currentKey);

      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(cameFrom, currentKey).slice(1, 8).map((cell) => this.cellToWorld(cell));
      }

      open.delete(currentKey);
      for (const neighbor of this.getOpenNeighbors(current)) {
        const neighborKey = this.cellKey(neighbor.x, neighbor.y);
        const tentative = this.mapScore(gScore, currentKey) + this.cellDistance(current, neighbor);
        if (tentative >= this.mapScore(gScore, neighborKey)) continue;

        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + this.cellDistance(neighbor, goal));
        open.add(neighborKey);
      }
    }

    return [];
  }

  private getOpenNeighbors(cell: GridCell): GridCell[] {
    const neighbors: GridCell[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: cell.x + dx, y: cell.y + dy };
        if (this.isCellBlocked(next)) continue;
        if (dx !== 0 && dy !== 0 && (this.isCellBlocked({ x: cell.x + dx, y: cell.y }) || this.isCellBlocked({ x: cell.x, y: cell.y + dy }))) {
          continue;
        }
        neighbors.push(next);
      }
    }
    return neighbors;
  }

  private hasClearPath(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const line = new Phaser.Geom.Line(fromX, fromY, toX, toY);
    return !this.getNavigationObstacles().some((rect) => Phaser.Geom.Intersects.LineToRectangle(line, rect));
  }

  private getNavigationObstacles(): Phaser.Geom.Rectangle[] {
    const wallRects = this.room.walls.map((wall) => new Phaser.Geom.Rectangle(wall.x - 8, wall.y - 8, wall.width + 16, wall.height + 16));
    const barricadeRects = (this.barricades?.getChildren() ?? [])
      .filter((child) => child.active)
      .map((child) => {
        const bounds = (child as Phaser.GameObjects.Image).getBounds();
        return new Phaser.Geom.Rectangle(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16);
      });
    return [...wallRects, ...barricadeRects];
  }

  private findNearestOpenCell(cell: GridCell): GridCell | null {
    if (!this.isCellBlocked(cell)) return cell;
    for (let radius = 1; radius <= 5; radius += 1) {
      for (let y = cell.y - radius; y <= cell.y + radius; y += 1) {
        for (let x = cell.x - radius; x <= cell.x + radius; x += 1) {
          const candidate = { x, y };
          if (!this.isCellBlocked(candidate)) return candidate;
        }
      }
    }
    return null;
  }

  private reconstructPath(cameFrom: Map<string, string>, endKey: string): GridCell[] {
    const path = [this.parseCellKey(endKey)];
    let currentKey = endKey;
    while (cameFrom.has(currentKey)) {
      currentKey = cameFrom.get(currentKey)!;
      path.unshift(this.parseCellKey(currentKey));
    }
    return path;
  }

  private isCellBlocked(cell: GridCell): boolean {
    if (cell.x < 0 || cell.y < 0 || cell.x >= this.navCols || cell.y >= this.navRows) return true;
    if (this.staticBlockedCells.has(this.cellKey(cell.x, cell.y))) return true;
    return (this.barricades?.getChildren() ?? []).some((child) => {
      if (!child.active) return false;
      const bounds = (child as Phaser.GameObjects.Image).getBounds();
      return this.cellOverlapsRect(cell, bounds, 8);
    });
  }

  private cellOverlapsRect(cell: GridCell, rect: { x: number; y: number; width: number; height: number }, padding: number): boolean {
    const center = this.cellToWorld(cell);
    return Phaser.Geom.Rectangle.Contains(
      new Phaser.Geom.Rectangle(rect.x - padding, rect.y - padding, rect.width + padding * 2, rect.height + padding * 2),
      center.x,
      center.y
    );
  }

  private worldToCell(x: number, y: number): GridCell {
    return {
      x: Phaser.Math.Clamp(Math.floor(x / this.navCellSize), 0, this.navCols - 1),
      y: Phaser.Math.Clamp(Math.floor(y / this.navCellSize), 0, this.navRows - 1)
    };
  }

  private cellToWorld(cell: GridCell): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      cell.x * this.navCellSize + this.navCellSize / 2,
      cell.y * this.navCellSize + this.navCellSize / 2
    );
  }

  private cellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private parseCellKey(key: string): GridCell {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  }

  private mapScore(scores: Map<string, number>, key: string): number {
    return scores.get(key) ?? Number.POSITIVE_INFINITY;
  }

  private cellDistance(a: GridCell, b: GridCell): number {
    return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  }

  private updateSpawning(time: number): void {
    if (this.enemiesQueued <= 0 || time < this.nextSpawnAt) return;

    const wave = createWave(this.waveNumber);
    const spawn = Phaser.Utils.Array.GetRandom(this.room.spawns);
    const definition = pickEnemyForWave(wave);
    const enemy = this.physics.add.sprite(spawn.x, spawn.y, definition.texture) as EnemySprite;
    this.configureEnemy(enemy, definition, wave);
    this.enemies.add(enemy);

    this.enemiesQueued -= 1;
    this.enemiesAlive += 1;
    this.nextSpawnAt = time + wave.spawnDelayMs;
  }

  private configureEnemy(enemy: EnemySprite, definition: EnemyDefinition, wave: ReturnType<typeof createWave>): void {
    enemy.kind = definition.kind;
    enemy.enemyId = this.nextEnemyId++;
    enemy.hp = Math.ceil(wave.enemyHealth * definition.healthMultiplier);
    enemy.reward = Math.ceil(wave.scoreReward * definition.rewardMultiplier);
    enemy.touchCooldown = 0;
    enemy.speed = wave.enemySpeed * definition.speedMultiplier;
    enemy.damage = definition.damage;
    enemy.touchCooldownMs = definition.touchCooldownMs;
    enemy.baseTexture = definition.texture;
    enemy.hitTexture = definition.hitTexture;
    enemy.setDrag(80, 80);
    enemy.setDepth(3);
    enemy.setScale(definition.kind === "runner" ? 0.86 : definition.kind === "brute" ? 1.28 : definition.kind === "spitter" ? 1.06 : 1);
    enemy.baseScale = enemy.scaleX;
    enemy.body!.setSize(28, 28);
    enemy.body!.setOffset(7, 7);
    enemy.stridePhase = Math.random() * Math.PI * 2;
    enemy.lastX = enemy.x;
    enemy.lastY = enemy.y;
    enemy.stuckMs = 0;
    enemy.unstuckUntil = 0;
    enemy.unstuckAngle = 0;
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.nextPathAt = 0;
    enemy.nextRangedAt = this.time.now + Phaser.Math.Between(700, 1800);
    enemy.projectileTexture = definition.projectileTexture;
    enemy.projectileDamage = definition.projectileDamage ?? 0;
    enemy.projectileSpeed = definition.projectileSpeed ?? 0;
    enemy.projectileCooldownMs = definition.projectileCooldownMs ?? 0;
    enemy.preferredRange = definition.preferredRange ?? 0;
  }

  private spawnBoss(wave: ReturnType<typeof createWave>): void {
    if (this.gameOver || !this.bossWave || this.boss?.active) return;

    const spawn = Phaser.Utils.Array.GetRandom(this.room.spawns);
    const boss = this.physics.add.sprite(spawn.x, spawn.y, "boss-butcher") as BossSprite;
    boss.enemyId = this.nextEnemyId++;
    boss.hp = 70 + wave.wave * 18;
    boss.kind = "boss";
    boss.maxHp = boss.hp;
    boss.reward = 1400 + wave.wave * 120;
    boss.touchCooldown = 0;
    boss.speed = 58 + wave.wave * 2;
    boss.damage = 18;
    boss.touchCooldownMs = 760;
    boss.baseTexture = "boss-butcher";
    boss.hitTexture = "boss-butcher-hit";
    boss.nextSummonAt = this.time.now + 2500;
    boss.nextShockwaveAt = this.time.now + 4500;
    boss.nextChargeAt = this.time.now + 6500;
    boss.chargingUntil = 0;
    boss.stridePhase = Math.random() * Math.PI * 2;
    boss.lastX = boss.x;
    boss.lastY = boss.y;
    boss.stuckMs = 0;
    boss.unstuckUntil = 0;
    boss.unstuckAngle = 0;
    boss.path = [];
    boss.pathIndex = 0;
    boss.nextPathAt = 0;
    boss.nextRangedAt = Number.POSITIVE_INFINITY;
    boss.projectileDamage = 0;
    boss.projectileSpeed = 0;
    boss.projectileCooldownMs = 0;
    boss.preferredRange = 0;
    boss.baseScale = 1;
    boss.setDepth(3.5);
    boss.setDrag(120, 120);
    boss.body!.setSize(48, 54);
    boss.body!.setOffset(16, 18);
    this.enemies.add(boss);
    this.enemiesAlive += 1;
    this.boss = boss;
    this.cameras.main.flash(180, 120, 36, 26);
    this.updateBossHud();
  }

  private spawnSplitterBoss(wave: ReturnType<typeof createWave>): void {
    if (this.gameOver || !this.splitterBossWave) return;

    const spawn = Phaser.Utils.Array.GetRandom(this.room.spawns);
    this.spawnSplitterBossCopy(spawn.x, spawn.y, 120 + wave.wave * 20, 1);
    this.cameras.main.flash(220, 80, 64, 170);
    this.updateBossHud();
  }

  private spawnSplitterBossCopy(x: number, y: number, hp: number, scale: number): BossSprite {
    const boss = this.physics.add.sprite(x, y, "boss-butcher") as BossSprite;
    boss.enemyId = this.nextEnemyId++;
    boss.hp = hp;
    boss.kind = "boss";
    boss.maxHp = hp;
    boss.reward = Math.ceil(520 * scale);
    boss.touchCooldown = 0;
    boss.speed = 74 + (1 - scale) * 70;
    boss.damage = Math.ceil(16 * scale);
    boss.touchCooldownMs = 720;
    boss.baseTexture = "boss-butcher";
    boss.hitTexture = "boss-butcher-hit";
    boss.nextSummonAt = Number.POSITIVE_INFINITY;
    boss.nextShockwaveAt = Number.POSITIVE_INFINITY;
    boss.nextChargeAt = Number.POSITIVE_INFINITY;
    boss.chargingUntil = 0;
    boss.stridePhase = Math.random() * Math.PI * 2;
    boss.lastX = x;
    boss.lastY = y;
    boss.stuckMs = 0;
    boss.unstuckUntil = 0;
    boss.unstuckAngle = 0;
    boss.path = [];
    boss.pathIndex = 0;
    boss.nextPathAt = 0;
    boss.nextRangedAt = Number.POSITIVE_INFINITY;
    boss.projectileDamage = 0;
    boss.projectileSpeed = 0;
    boss.projectileCooldownMs = 0;
    boss.preferredRange = 0;
    boss.baseScale = scale;
    boss.isSplitterBoss = true;
    boss.splitterScale = scale;
    boss.setTint(0x8f6dff);
    boss.setDepth(3.5);
    boss.setDrag(120, 120);
    boss.setScale(scale);
    boss.body!.setSize(Math.max(24, 48 * scale), Math.max(26, 54 * scale));
    boss.body!.setOffset(16 * scale, 18 * scale);
    this.enemies.add(boss);
    this.enemiesAlive += 1;
    this.splitterBossSpawned += 1;
    this.boss = boss;
    return boss;
  }

  private updateBoss(time: number): void {
    if (!this.bossWave || !this.boss?.active) return;
    if (this.boss.isSplitterBoss) return;

    if (time >= this.boss.nextSummonAt) {
      this.boss.nextSummonAt = time + 6200;
      this.bossSummonRunners();
    }

    if (time >= this.boss.nextShockwaveAt) {
      this.boss.nextShockwaveAt = time + 7600;
      this.bossShockwave();
    }

    if (time >= this.boss.nextChargeAt) {
      this.boss.nextChargeAt = time + 8800;
      this.bossCharge();
    }
  }

  private bossSummonRunners(): void {
    if (!this.boss?.active) return;
    const target = this.getNearestLivingPlayer(this.boss.x, this.boss.y) ?? this.player;
    const runner = getEnemy("runner");
    const wave = createWave(this.waveNumber);
    const sortedSpawns = [...this.room.spawns].sort((a, b) => {
      const da = Phaser.Math.Distance.Between(a.x, a.y, target.x, target.y);
      const db = Phaser.Math.Distance.Between(b.x, b.y, target.x, target.y);
      return db - da;
    });

    for (const spawn of sortedSpawns.slice(0, 3)) {
      const enemy = this.physics.add.sprite(spawn.x, spawn.y, runner.texture) as EnemySprite;
      this.configureEnemy(enemy, runner, wave);
      enemy.hp += 1;
      this.enemies.add(enemy);
      this.enemiesAlive += 1;
    }
  }

  private bossShockwave(): void {
    if (!this.boss?.active) return;
    const x = this.boss.x;
    const y = this.boss.y;
    const radius = 148;
    const warning = this.add.circle(x, y, radius, 0xc73c31, 0.18).setDepth(2.8);
    warning.setStrokeStyle(4, 0xe1b652, 0.95);
    this.tweens.add({ targets: warning, alpha: 0.55, scale: 1.08, yoyo: true, repeat: 2, duration: 140 });

    this.time.delayedCall(760, () => {
      warning.destroy();
      const blast = this.add.circle(x, y, radius, 0xe1b652, 0.22).setDepth(2.8);
      this.tweens.add({ targets: blast, alpha: 0, scale: 1.25, duration: 220, onComplete: () => blast.destroy() });
      this.cameras.main.shake(180, 0.007);
      for (const target of this.getLivingPlayers()) {
        if (Phaser.Math.Distance.Between(x, y, target.x, target.y) <= radius) {
          this.damagePlayerTarget(target, 22);
        }
      }
    });
  }

  private bossCharge(): void {
    if (!this.boss?.active) return;
    const target = this.getNearestLivingPlayer(this.boss.x, this.boss.y) ?? this.player;
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, target.x, target.y);
    const telegraph = this.add.rectangle(this.boss.x + Math.cos(angle) * 90, this.boss.y + Math.sin(angle) * 90, 190, 34, 0xc73c31, 0.26);
    telegraph.setDepth(2.8).setRotation(angle);
    this.tweens.add({ targets: telegraph, alpha: 0.6, yoyo: true, repeat: 2, duration: 120 });
    this.time.delayedCall(520, () => {
      telegraph.destroy();
      if (!this.boss?.active) return;
      const velocity = velocityFromAngle(angle, 360);
      this.boss.setVelocity(velocity.x, velocity.y);
      this.boss.chargingUntil = this.time.now + 680;
    });
  }

  private hitEnemy(bullet: BulletSprite, enemy: EnemySprite): void {
    enemy.hp -= bullet.damage;
    enemy.setTexture(enemy.hitTexture);
    if (this.currentWeapon.knockback) {
      const knockbackAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const knockback = velocityFromAngle(knockbackAngle, this.currentWeapon.knockback);
      enemy.setVelocity(enemy.body!.velocity.x + knockback.x, enemy.body!.velocity.y + knockback.y);
    }
    this.time.delayedCall(70, () => {
      if (enemy.active) enemy.setTexture(enemy.baseTexture);
    });
    this.tweens.killTweensOf(enemy);
    enemy.setScale(enemy.baseScale);
    this.tweens.add({
      targets: enemy,
      scaleX: enemy.baseScale * 1.12,
      scaleY: enemy.baseScale * 0.88,
      duration: 70,
      yoyo: true
    });

    if (bullet.explosiveRadius > 0) {
      this.explodeAt(bullet.x, bullet.y, bullet.explosiveRadius, bullet.damage);
      bullet.destroy();
    } else if (bullet.pierce > 0) {
      bullet.pierce -= 1;
    } else {
      bullet.destroy();
    }

    if (enemy.hp <= 0 && enemy.active) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: EnemySprite): void {
    if (enemy.deathHandled) return;
    enemy.deathHandled = true;
    this.score += enemy.reward;
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);
    this.add.image(enemy.x, enemy.y, "decal-stain").setDepth(0.18).setAlpha(0.65).setRotation(Math.random() * Math.PI);
    if ((enemy as BossSprite).isSplitterBoss) {
      this.handleSplitterBossDeath(enemy as BossSprite);
    } else if (enemy === this.boss) {
      this.score += 1800 + this.waveNumber * 180;
      this.cameras.main.flash(250, 225, 182, 82);
      this.clearBossWaveAdds();
      this.boss = null;
      this.updateBossHud();
    } else {
      this.maybeDropPickup(enemy.x, enemy.y);
    }
    enemy.body!.enable = false;
    enemy.setVelocity(0, 0);
    this.tweens.killTweensOf(enemy);
    enemy.setScale(enemy.baseScale);
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      scaleX: enemy.baseScale * 1.22,
      scaleY: enemy.baseScale * 0.72,
      angle: Phaser.Math.Between(-10, 10),
      duration: 170,
      onComplete: () => enemy.destroy()
    });
    this.broadcastImmediateState();
    const bestWeapon = getBestUnlockedWeapon(this.score);
    if (bestWeapon.unlockScore <= this.score && this.currentWeapon.key === "pistol" && bestWeapon.key !== "pistol") {
      this.equipWeapon(bestWeapon);
      this.addAmmo(bestWeapon.key, bestWeapon.clipPickup);
    }
  }

  private handleSplitterBossDeath(boss: BossSprite): void {
    this.splitterBossKilled = Math.min(SPLITTER_BOSS_MAX_KILLS, this.splitterBossKilled + 1);
    this.score += 240 + this.waveNumber * 45;
    this.cameras.main.flash(110, 160, 105, 255);

    const split = planSplitterBossDeath({
      spawned: this.splitterBossSpawned,
      killed: this.splitterBossKilled,
      parentHp: boss.maxHp,
      parentScale: boss.splitterScale ?? boss.baseScale
    });

    const spread = 42 * (boss.splitterScale ?? boss.baseScale);
    split.copiesToSpawn.forEach((copy, index) => {
      const angle = index === 0 ? -0.75 : 0.75;
      this.spawnSplitterBossCopy(
        Phaser.Math.Clamp(boss.x + Math.cos(angle) * spread, 28, this.room.width - 28),
        Phaser.Math.Clamp(boss.y + Math.sin(angle) * spread, 28, this.room.height - 28),
        copy.hp,
        copy.scale
      );
    });

    if (this.boss === boss) {
      this.boss = this.findActiveSplitterBoss(boss);
    }
    this.updateBossHud();
  }

  private findActiveSplitterBoss(exclude?: BossSprite): BossSprite | null {
    return ((this.enemies.getChildren() as EnemySprite[]).find((enemy) => enemy !== exclude && enemy.active && (enemy as BossSprite).isSplitterBoss) as BossSprite | undefined) ?? null;
  }

  private maybeDropPickup(x: number, y: number): void {
    const roll = Math.random();
    if (roll > 0.28) return;

    let kind: PickupKind = "ammo";
    let texture = "pickup-ammo";
    let weaponKey: WeaponKey | undefined;

    if (this.health < 72 && roll < 0.08) {
      kind = "health";
      texture = "pickup-health";
    } else {
      const unlocked = WEAPONS.filter((weapon) => weapon.key !== "pistol" && this.score >= weapon.unlockScore);
      weaponKey = (Phaser.Utils.Array.GetRandom(unlocked) ?? getBestUnlockedWeapon(this.score)).key;
      kind = roll < 0.14 ? "weapon" : "ammo";
      texture = kind === "weapon"
        ? getWeaponPickupTexture(weaponKey)
        : getAmmoPickupTexture(weaponKey);
    }

    const pickup = this.physics.add.image(x, y, texture) as PickupSprite;
    pickup.kind = kind;
    pickup.pickupId = this.nextPickupId++;
    pickup.weaponKey = weaponKey;
    pickup.setScale(1.1);
    pickup.setCircle(13);
    pickup.setDepth(2.5);
    this.pickups.add(pickup);
  }

  private createRoomDressing(): void {
    const dressingByRoom: Record<string, Array<{ x: number; y: number; texture: string; rotation?: number; alpha?: number }>> = {
      crossfire: [
        { x: 116, y: 150, texture: "prop-crate" },
        { x: 844, y: 492, texture: "prop-crate", rotation: 0.08 },
        { x: 322, y: 404, texture: "prop-vent" },
        { x: 668, y: 238, texture: "prop-vent", rotation: Math.PI / 2 },
        { x: 252, y: 278, texture: "decal-crack", rotation: 0.5 },
        { x: 714, y: 370, texture: "decal-crack", rotation: -0.45 },
        { x: 482, y: 318, texture: "decal-stain", alpha: 0.34 }
      ],
      trenches: [
        { x: 236, y: 522, texture: "prop-crate" },
        { x: 716, y: 104, texture: "prop-crate", rotation: -0.12 },
        { x: 410, y: 220, texture: "prop-vent" },
        { x: 552, y: 424, texture: "prop-vent" },
        { x: 246, y: 294, texture: "decal-crack", rotation: -0.15 },
        { x: 704, y: 318, texture: "decal-crack", rotation: 0.35 },
        { x: 486, y: 548, texture: "decal-stain", alpha: 0.28 }
      ],
      boxyard: [
        { x: 118, y: 280, texture: "prop-crate", rotation: 0.08 },
        { x: 844, y: 368, texture: "prop-crate", rotation: -0.08 },
        { x: 480, y: 112, texture: "prop-vent" },
        { x: 480, y: 528, texture: "prop-vent", rotation: Math.PI },
        { x: 352, y: 392, texture: "decal-crack", rotation: 0.1 },
        { x: 610, y: 228, texture: "decal-crack", rotation: -0.3 },
        { x: 478, y: 320, texture: "decal-stain", alpha: 0.3 }
      ]
    };

    for (const item of dressingByRoom[this.room.key] ?? []) {
      this.add
        .image(item.x, item.y, item.texture)
        .setDepth(item.texture.startsWith("prop") ? 0.25 : 0.15)
        .setRotation(item.rotation ?? 0)
        .setAlpha(item.alpha ?? 1);
    }

    for (const spawn of this.room.spawns) {
      this.add.rectangle(spawn.x, spawn.y, 42, 42, 0x1a1a15, 0.42).setDepth(0.12);
      this.add.rectangle(spawn.x, spawn.y, 28, 28, 0x312f27, 0.42).setDepth(0.13);
    }
  }

  private spawnMuzzleFlash(angle: number): void {
    const flashPoint = spawnPointFromAngle(this.player, angle, 48);
    const flash = this.add.image(flashPoint.x, flashPoint.y, "muzzle-flash");
    flash.setDepth(6);
    flash.setRotation(angle);
    flash.setScale(Phaser.Math.FloatBetween(0.85, 1.15));
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 70,
      onComplete: () => flash.destroy()
    });
  }

  private collectPickup(pickup: PickupSprite): void {
    if (pickup.kind === "health") {
      this.health = Math.min(100, this.health + 26);
    }

    if (pickup.kind === "ammo" && pickup.weaponKey) {
      this.addAmmo(pickup.weaponKey, getWeapon(pickup.weaponKey).clipPickup);
    }

    if (pickup.kind === "weapon" && pickup.weaponKey) {
      const weapon = getWeapon(pickup.weaponKey);
      this.equipWeapon(weapon);
      this.addAmmo(weapon.key, weapon.clipPickup);
    }

    pickup.destroy();
  }

  private addAmmo(weaponKey: WeaponKey, amount: number): void {
    const weapon = getWeapon(weaponKey);
    const current = this.ammo.get(weaponKey) ?? 0;
    this.ammo.set(weaponKey, Math.min(weapon.maxAmmo, current + amount));
  }

  private damageBarricade(enemy: EnemySprite, barricade: BarricadeSprite): void {
    if (enemy === this.boss && this.boss.chargingUntil > this.time.now) {
      barricade.hp = 0;
      barricade.destroy();
      return;
    }

    if (enemy.touchCooldown > 0) return;
    enemy.touchCooldown = 360;
    barricade.hp -= 1;
    barricade.setAlpha(Math.max(0.24, barricade.hp / 7));
    if (barricade.hp <= 0) {
      barricade.destroy();
    }
  }

  private explodeBarrel(barrel: BarrelSprite): void {
    if (barrel.exploded) return;
    barrel.exploded = true;
    this.explodeAt(barrel.x, barrel.y, 116, 5);
    barrel.destroy();
  }

  private explodeAt(x: number, y: number, radius: number, damage: number): void {
    const flash = this.add.circle(x, y, radius, 0xf25b38, 0.26);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      duration: 170,
      onComplete: () => flash.destroy()
    });
    this.cameras.main.shake(110, 0.006);

    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance <= radius) {
        enemy.hp -= damage;
        if (enemy.hp <= 0 && enemy.active) {
          this.killEnemy(enemy);
        }
      }
    }

    for (const target of this.getLivingPlayers()) {
      if (Phaser.Math.Distance.Between(x, y, target.x, target.y) <= radius * 0.56) {
        this.damagePlayerTarget(target, 14);
      }
    }
  }

  private hitPlayerWithEnemyProjectile(projectile: EnemyProjectileSprite, target: PlayerTarget = this.player): void {
    if (!projectile.active) return;

    const splash = this.add.circle(projectile.x, projectile.y, 24, 0x6ee28e, 0.24).setDepth(4.7);
    this.tweens.add({
      targets: splash,
      alpha: 0,
      scale: 1.5,
      duration: 180,
      onComplete: () => splash.destroy()
    });
    this.damagePlayerTarget(target, projectile.damage);
    projectile.destroy();
  }

  private getLivingPlayers(): PlayerTarget[] {
    const players: PlayerTarget[] = [];
    if (!this.spectating && this.health > 0 && this.player.active) {
      players.push(this.player);
    }
    for (const sprite of this.remotePlayers.values()) {
      if (!sprite.dead && sprite.hp > 0 && sprite.active) {
        players.push(sprite);
      }
    }
    return players;
  }

  private getNearestLivingPlayer(x: number, y: number): PlayerTarget | null {
    let nearest: PlayerTarget | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of this.getLivingPlayers()) {
      const distance = Phaser.Math.Distance.Between(x, y, target.x, target.y);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private damagePlayerTarget(target: PlayerTarget, amount: number): void {
    if (target === this.player) {
      this.damagePlayer(amount);
      return;
    }
    this.damageRemotePlayer(target as PlayerSprite, amount);
  }

  private damageRemotePlayer(sprite: PlayerSprite, amount: number): void {
    if (sprite.dead) return;
    sprite.hp = Math.max(0, sprite.hp - amount);
    sprite.setTint(0xff7777);
    this.tweens.add({ targets: sprite, scaleX: 1.09, scaleY: 0.91, duration: 70, yoyo: true });
    this.time.delayedCall(75, () => {
      if (sprite.active && !sprite.dead) sprite.clearTint();
    });
    if (sprite.hp <= 0) {
      this.killRemotePlayer(sprite);
    }
  }

  private damagePlayer(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.player.setTint(0xff7777);
    const knockback = velocityFromAngle(this.aimAngle + Math.PI, 84);
    this.player.setVelocity(this.player.body!.velocity.x + knockback.x, this.player.body!.velocity.y + knockback.y);
    this.tweens.add({ targets: this.player, scaleX: 1.09, scaleY: 0.91, duration: 70, yoyo: true });
    this.time.delayedCall(75, () => this.player.clearTint());
    if (this.health <= 0) {
      this.endRun();
    }
  }

  private checkWaveClear(time: number): void {
    if (this.bossWave) {
      if (this.splitterBossWave) {
        if (this.enemiesQueued > 0 || this.enemiesAlive > 0 || this.splitterBossKilled < SPLITTER_BOSS_MAX_KILLS) return;
        this.score += 600 + this.waveNumber * 120;
        this.startWave(this.waveNumber + 1);
        this.nextSpawnAt = time + 1800;
        return;
      }
      if (!this.boss && this.enemiesQueued > 0) return;
      if (this.boss?.active) return;
      this.score += 420 + this.waveNumber * 85;
      this.startWave(this.waveNumber + 1);
      this.nextSpawnAt = time + 1650;
      return;
    }

    if (this.enemiesQueued > 0 || this.enemiesAlive > 0) return;
    this.score += 220 + this.waveNumber * 60;
    this.startWave(this.waveNumber + 1);
    this.nextSpawnAt = time + 1450;
  }

  private cleanupBullets(time: number): void {
    for (const bullet of this.bullets.getChildren() as BulletSprite[]) {
      if (time - bullet.bornAt > 1200) {
        bullet.destroy();
      }
    }
  }

  private cleanupEnemyProjectiles(time: number): void {
    for (const projectile of this.enemyProjectiles.getChildren() as EnemyProjectileSprite[]) {
      if (time - projectile.bornAt > 2600) {
        projectile.destroy();
      }
    }
  }

  private broadcastState(): void {
    const players: StateSnapshot["players"] = [
      {
        id: this.myId,
        x: this.player.x,
        y: this.player.y,
        hp: this.health,
        aimAngle: this.aimAngle,
        weaponKey: this.currentWeapon.key,
        score: this.score,
        dead: this.spectating,
        facingLeft: this.facingDirection < 0
      },
      ...[...this.remotePlayers.values()].map((sprite) => ({
        id: sprite.playerId,
        x: sprite.x,
        y: sprite.y,
        hp: sprite.hp,
        aimAngle: sprite.aimAngle,
        weaponKey: sprite.currentWeaponKey,
        score: sprite.score,
        dead: sprite.dead,
        facingLeft: sprite.facingLeft
      }))
    ];

    network.send({
      type: "state",
      payload: {
        wave: this.waveNumber,
        players,
        enemies: (this.enemies.getChildren() as EnemySprite[])
          .filter((enemy) => enemy.active)
          .map((enemy) => ({ id: enemy.enemyId, x: enemy.x, y: enemy.y, hp: enemy.hp, kind: enemy.kind, dying: !!enemy.deathHandled })),
        boss: this.boss?.active ? { x: this.boss.x, y: this.boss.y, hp: this.boss.hp, maxHp: this.boss.maxHp } : null,
        pickups: (this.pickups.getChildren() as PickupSprite[])
          .filter((pickup) => pickup.active)
          .map((pickup) => ({ id: pickup.pickupId, x: pickup.x, y: pickup.y, kind: pickup.kind }))
      }
    });
  }

  private broadcastImmediateState(): void {
    if (!this.isHost || this.gameMode === "solo") return;
    this.lastBroadcastAt = this.time.now;
    this.broadcastState();
  }

  private applyPendingSnapshot(): void {
    if (this.isHost || this.gameMode === "solo" || !this.latestSnapshot) return;
    this.applySnapshot(this.latestSnapshot);
    this.latestSnapshot = null;
  }

  private applySnapshot(snapshot: StateSnapshot): void {
    this.waveNumber = snapshot.wave;
    for (const playerState of snapshot.players) {
      if (playerState.id === this.myId) {
        this.health = playerState.hp;
        this.score = playerState.score;
        if (playerState.dead && !this.spectating) this.enterSpectatorMode();
        continue;
      }

      const sprite = this.remotePlayers.get(playerState.id);
      if (!sprite) continue;
      sprite.setPosition(playerState.x, playerState.y);
      sprite.hp = playerState.hp;
      sprite.score = playerState.score;
      sprite.dead = playerState.dead;
      sprite.aimAngle = playerState.aimAngle;
      sprite.facingLeft = playerState.facingLeft;
      sprite.currentWeaponKey = playerState.weaponKey as WeaponKey;
      sprite.setAlpha(sprite.dead ? 0.25 : 1);
      sprite.setFlipX(sprite.facingLeft);
      sprite.weaponImage?.setPosition(sprite.x, sprite.y);
      sprite.weaponImage?.setRotation(sprite.aimAngle);
      sprite.weaponImage?.setTexture(HELD_WEAPON_TEXTURES[sprite.currentWeaponKey] ?? HELD_WEAPON_TEXTURES.pistol);
    }

    const liveEnemyIds = new Set(snapshot.enemies.map((enemy) => enemy.id));
    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      if (!liveEnemyIds.has(enemy.enemyId)) enemy.destroy();
    }
    for (const enemyState of snapshot.enemies) {
      let enemy = (this.enemies.getChildren() as EnemySprite[]).find((candidate) => candidate.enemyId === enemyState.id);
      if (!enemy) {
        const definition = enemyState.kind === "boss" ? null : getEnemy(enemyState.kind as EnemyKind);
        enemy = this.enemies.create(enemyState.x, enemyState.y, definition?.texture ?? "boss-butcher") as EnemySprite;
        enemy.enemyId = enemyState.id;
        enemy.kind = enemyState.kind;
        enemy.hp = enemyState.hp;
        enemy.reward = 0;
        enemy.touchCooldown = 0;
        enemy.speed = 0;
        enemy.damage = 0;
        enemy.touchCooldownMs = 0;
        enemy.hitTexture = definition?.hitTexture ?? "boss-butcher-hit";
        enemy.baseTexture = definition?.texture ?? "boss-butcher";
        enemy.baseScale = 1;
        enemy.stridePhase = 0;
        enemy.lastX = enemyState.x;
        enemy.lastY = enemyState.y;
        enemy.stuckMs = 0;
        enemy.unstuckUntil = 0;
        enemy.unstuckAngle = 0;
        enemy.path = [];
        enemy.pathIndex = 0;
        enemy.nextPathAt = 0;
        enemy.nextRangedAt = 0;
        enemy.projectileDamage = 0;
        enemy.projectileSpeed = 0;
        enemy.projectileCooldownMs = 0;
        enemy.preferredRange = 0;
        enemy.body!.enable = false;
        enemy.setDepth(3);
      }
      if (enemyState.dying) {
        enemy.setPosition(enemyState.x, enemyState.y);
        enemy.hp = enemyState.hp;
        if (!enemy.deathHandled) {
          this.playSnapshotEnemyDeath(enemy);
        }
        continue;
      }
      enemy.setPosition(enemyState.x, enemyState.y);
      enemy.hp = enemyState.hp;
    }
    this.updatePlayerLabels();
  }

  private playSnapshotEnemyDeath(enemy: EnemySprite): void {
    enemy.deathHandled = true;
    enemy.hp = 0;
    enemy.body!.enable = false;
    enemy.setPosition(enemy.x, enemy.y);
    this.add.image(enemy.x, enemy.y, "decal-stain").setDepth(0.18).setAlpha(0.65).setRotation(Math.random() * Math.PI);
    this.tweens.killTweensOf(enemy);
    enemy.setScale(enemy.baseScale);
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      scaleX: enemy.baseScale * 1.22,
      scaleY: enemy.baseScale * 0.72,
      angle: Phaser.Math.Between(-10, 10),
      duration: 170,
      onComplete: () => enemy.destroy()
    });
  }

  private updatePlayerLabels(): void {
    for (const sprite of this.remotePlayers.values()) {
      sprite.weaponImage?.setPosition(sprite.x, sprite.y);
      sprite.nameLabel?.setPosition(sprite.x, sprite.y - 32);
    }
  }

  private updateHud(): void {
    this.setText("#hud-health", `HP ${this.health}`);
    this.setText("#hud-wave", `Wave ${this.waveNumber}`);
    this.setText("#hud-score", `Score ${this.score}`);
    this.setText("#hud-weapon", this.currentWeapon.label);
    this.setText("#hud-ammo", this.currentWeapon.ammoPerShot === 0 ? "Ammo --" : `Ammo ${this.ammo.get(this.currentWeapon.key) ?? 0}`);
    this.updateBossHud();
  }

  private updateBossHud(): void {
    this.bossHudEl ??= document.querySelector("#boss-hud");
    this.bossHpFillEl ??= document.querySelector("#boss-hp-fill");
    if (!this.bossHudEl || !this.bossHpFillEl) return;

    if (!this.bossWave || !this.boss?.active) {
      this.bossHudEl.classList.add("is-hidden");
      this.bossHpFillEl.style.width = "0%";
      return;
    }

    this.bossHudEl.classList.remove("is-hidden");
    this.bossHpFillEl.style.width = `${Phaser.Math.Clamp((this.boss.hp / this.boss.maxHp) * 100, 0, 100)}%`;
  }

  private clearBossWaveAdds(): void {
    for (const enemy of this.enemies.getChildren() as EnemySprite[]) {
      if (enemy.active && enemy !== this.boss) {
        enemy.destroy();
      }
    }
    this.enemiesAlive = 0;
    this.enemiesQueued = 0;
  }

  private setText(selector: string, value: string): void {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

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
    this.touchControlsEl?.classList.add("is-hidden");
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

  private enterSpectatorMode(): void {
    if (this.spectating) return;
    this.spectating = true;
    this.health = 0;
    this.player.setAlpha(0.25);
    this.player.setVelocity(0, 0);
    this.player.body!.enable = false;
    this.playerWeapon.setVisible(false);
    this.touchControlsEl?.classList.add("is-hidden");
    this.spectatorTargets = [...this.remotePlayers.values()].filter((sprite) => !sprite.dead).map((sprite) => sprite.playerId);
    this.spectatorIndex = 0;
    this.spectatorBarEl?.classList.remove("is-hidden");
    this.followSpectatorTarget();
    document.querySelector("#spectator-prev")?.addEventListener("click", () => this.prevSpectatorTarget());
    document.querySelector("#spectator-next")?.addEventListener("click", () => this.nextSpectatorTarget());
  }

  private followSpectatorTarget(): void {
    const targetId = this.spectatorTargets[this.spectatorIndex];
    if (targetId === undefined) return;
    const sprite = this.remotePlayers.get(targetId);
    if (!sprite) return;
    this.cameras.main.startFollow(sprite, true, 0.08, 0.08);
    const lobbyPlayer = this.lobbyPlayers.find((player) => player.id === targetId);
    if (this.spectatorNameEl) this.spectatorNameEl.textContent = lobbyPlayer?.name ?? "Player";
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

  private killRemotePlayer(sprite: PlayerSprite): void {
    if (sprite.dead) return;
    sprite.dead = true;
    sprite.hp = 0;
    sprite.body!.enable = false;
    sprite.setVelocity(0, 0);
    this.tweens.add({ targets: sprite, alpha: 0.25, duration: 220 });
    this.checkMultiplayerGameOver();
  }

  private checkMultiplayerGameOver(): void {
    if (this.gameMode === "solo") return;

    const aliveRemote = [...this.remotePlayers.values()].filter((sprite) => !sprite.dead);
    const localAlive = !this.spectating && this.health > 0;
    const aliveCount = aliveRemote.length + (localAlive ? 1 : 0);

    if ((this.gameMode === "coop" && aliveCount === 0) || (this.gameMode === "pvp" && aliveCount <= 1)) {
      const winner = this.gameMode === "pvp" && localAlive
        ? this.lobbyPlayers.find((player) => player.id === this.myId)?.name ?? "You"
        : this.gameMode === "pvp" && aliveRemote[0]
          ? this.lobbyPlayers.find((player) => player.id === aliveRemote[0]!.playerId)?.name ?? "Player"
          : undefined;
      this.showMultiplayerRunOver(winner);
    }
  }

  private showMultiplayerRunOver(winner?: string): void {
    this.gameOver = true;
    this.physics.pause();
    this.spectatorBarEl?.classList.add("is-hidden");
    this.pvpBoardEl?.classList.add("is-hidden");
    this.hudEl?.classList.add("is-hidden");
    this.touchControlsEl?.classList.add("is-hidden");
    if (!this.menuEl) return;

    this.menuEl.classList.remove("is-hidden");
    this.menuEl.innerHTML = `
      <section class="menu__panel">
        <h1 class="menu__title">${winner ? `${winner} Wins!` : "Run Over"}</h1>
        <p class="menu__copy">Wave ${this.waveNumber} in ${this.room.name}.</p>
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

    const rows = this.lobbyPlayers.map((player) => {
      const remote = this.remotePlayers.get(player.id);
      const score = player.id === this.myId ? this.score : remote?.score ?? 0;
      const dead = player.id === this.myId ? this.spectating || this.health <= 0 : remote?.dead ?? false;
      return { name: player.name, score, dead };
    }).sort((a, b) => b.score - a.score);

    this.pvpBoardEl.classList.remove("is-hidden");
    this.pvpBoardEl.innerHTML = rows.map((row) => (
      `<div class="pvp-board__row${row.dead ? " dead" : ""}"><span>${row.name}</span><span>${row.score}</span></div>`
    )).join("");
  }

  private showHostLeftMessage(): void {
    this.physics.pause();
    this.touchControlsEl?.classList.add("is-hidden");
    this.menuEl?.classList.remove("is-hidden");
    if (this.menuEl) {
      this.menuEl.innerHTML = `
        <section class="menu__panel">
          <h1 class="menu__title">Host disconnected</h1>
          <p class="menu__copy">Returning to menu...</p>
        </section>
      `;
    }
    this.time.delayedCall(3000, () => this.scene.start("ModeScene"));
  }
}
