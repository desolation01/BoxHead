import type { EnemyDefinition, EnemyKind, WaveDefinition } from "./types";

export const ENEMIES: EnemyDefinition[] = [
  {
    kind: "shambler",
    label: "Shambler",
    texture: "enemy-shambler",
    hitTexture: "enemy-shambler-hit",
    unlockWave: 1,
    weight: 10,
    healthMultiplier: 1,
    speedMultiplier: 1,
    rewardMultiplier: 1,
    damage: 8,
    touchCooldownMs: 540
  },
  {
    kind: "runner",
    label: "Runner",
    texture: "enemy-runner",
    hitTexture: "enemy-runner-hit",
    unlockWave: 2,
    weight: 5,
    healthMultiplier: 0.7,
    speedMultiplier: 1.55,
    rewardMultiplier: 1.15,
    damage: 6,
    touchCooldownMs: 420,
    tint: 0xb4d56d
  },
  {
    kind: "brute",
    label: "Brute",
    texture: "enemy-brute",
    hitTexture: "enemy-brute-hit",
    unlockWave: 4,
    weight: 3,
    healthMultiplier: 2.6,
    speedMultiplier: 0.72,
    rewardMultiplier: 2.2,
    damage: 14,
    touchCooldownMs: 700,
    tint: 0x9f6a55
  },
  {
    kind: "spitter",
    label: "Spitter",
    texture: "enemy-spitter",
    hitTexture: "enemy-spitter-hit",
    unlockWave: 6,
    weight: 2,
    healthMultiplier: 1.25,
    speedMultiplier: 0.92,
    rewardMultiplier: 1.75,
    damage: 11,
    touchCooldownMs: 640,
    tint: 0x71d1a1,
    projectileTexture: "enemy-projectile-acid",
    projectileDamage: 9,
    projectileSpeed: 260,
    projectileCooldownMs: 1500,
    preferredRange: 260
  }
];

export function getEnemy(kind: EnemyKind): EnemyDefinition {
  const enemy = ENEMIES.find((candidate) => candidate.kind === kind);
  if (!enemy) {
    throw new Error(`Unknown enemy: ${kind}`);
  }
  return enemy;
}

export function pickEnemyForWave(wave: WaveDefinition, random = Math.random): EnemyDefinition {
  const candidates = ENEMIES.filter((enemy) => wave.wave >= enemy.unlockWave);
  const totalWeight = candidates.reduce((sum, enemy) => sum + enemy.weight, 0);
  let roll = random() * totalWeight;

  for (const enemy of candidates) {
    roll -= enemy.weight;
    if (roll <= 0) {
      return enemy;
    }
  }

  return candidates[0] ?? getEnemy("shambler");
}
