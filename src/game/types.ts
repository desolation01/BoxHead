export type WeaponKey =
  | "pistol"
  | "magnum"
  | "shotgun"
  | "ak47"
  | "uzi"
  | "crossbow"
  | "flameBurst"
  | "barrelLauncher"
  | "railBurst"
  | "minigun";

export type EnemyKind = "shambler" | "runner" | "brute" | "spitter";

export type PickupKind = "health" | "ammo" | "weapon";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeaponDefinition {
  key: WeaponKey;
  label: string;
  unlockScore: number;
  fireRateMs: number;
  bulletSpeed: number;
  damage: number;
  spread: number;
  pellets: number;
  ammoPerShot: number;
  clipPickup: number;
  maxAmmo: number;
  color: number;
  explosiveRadius?: number;
  pierce?: number;
  flameRadius?: number;
  knockback?: number;
}

export interface EnemyDefinition {
  kind: EnemyKind;
  label: string;
  texture: string;
  hitTexture: string;
  unlockWave: number;
  weight: number;
  healthMultiplier: number;
  speedMultiplier: number;
  rewardMultiplier: number;
  damage: number;
  touchCooldownMs: number;
  tint?: number;
  projectileTexture?: string;
  projectileDamage?: number;
  projectileSpeed?: number;
  projectileCooldownMs?: number;
  preferredRange?: number;
}

export interface RoomDefinition {
  key: string;
  name: string;
  description: string;
  width: number;
  height: number;
  playerStart: Vector2;
  walls: Rect[];
  barricades: Rect[];
  barrels: Vector2[];
  spawns: Vector2[];
}

export interface WaveDefinition {
  wave: number;
  enemyCount: number;
  spawnDelayMs: number;
  enemySpeed: number;
  enemyHealth: number;
  scoreReward: number;
}
