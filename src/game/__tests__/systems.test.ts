import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getEnemy, pickEnemyForWave } from "../enemies";
import { spawnPointFromAngle, velocityFromAngle } from "../projectiles";
import { ROOMS } from "../rooms";
import { createWave } from "../waves";
import { getBestUnlockedWeapon, getUnlockedWeapons, STARTING_WEAPON, WEAPONS } from "../weapons";

describe("weapon progression", () => {
  it("starts with Flame Burst and infinite ammo for every weapon", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(STARTING_WEAPON.key).toBe("flameBurst");
    expect(WEAPONS.every((weapon) => weapon.maxAmmo === Number.POSITIVE_INFINITY)).toBe(true);
    expect(gameScene).toContain("this.ammo = new Map(WEAPONS.map((weapon) => [weapon.key, Number.POSITIVE_INFINITY]))");
    expect(gameScene).not.toContain("weaponAmmo - this.currentWeapon.ammoPerShot");
    expect(gameScene).toContain('this.setText("#hud-ammo", "Ammo INF")');
  });

  it("keeps weapons sorted by unlock score", () => {
    const unlockScores = WEAPONS.map((weapon) => weapon.unlockScore);
    expect(unlockScores).toEqual([...unlockScores].sort((a, b) => a - b));
  });

  it("returns the best unlocked weapon for a score", () => {
    expect(getBestUnlockedWeapon(0).key).toBe("pistol");
    expect(getBestUnlockedWeapon(1200).key).toBe("ak47");
    expect(getBestUnlockedWeapon(1700).key).toBe("uzi");
    expect(getUnlockedWeapons(2200).map((weapon) => weapon.key)).toContain("crossbow");
    expect(getUnlockedWeapons(6000).map((weapon) => weapon.key)).toContain("railBurst");
    expect(getBestUnlockedWeapon(8000).key).toBe("minigun");
  });
});

describe("wave scaling", () => {
  it("increases enemy pressure over time", () => {
    const first = createWave(1);
    const sixth = createWave(6);

    expect(sixth.enemyCount).toBeGreaterThan(first.enemyCount);
    expect(sixth.enemySpeed).toBeGreaterThan(first.enemySpeed);
    expect(sixth.spawnDelayMs).toBeLessThan(first.spawnDelayMs);
  });
});

describe("enemy progression", () => {
  it("starts with shamblers and unlocks special enemies later", () => {
    expect(pickEnemyForWave(createWave(1), () => 0.1).kind).toBe("shambler");

    const lateEnemyKinds = new Set(
      Array.from({ length: 20 }, (_, index) => pickEnemyForWave(createWave(7), () => index / 20).kind)
    );
    expect(lateEnemyKinds.has("runner")).toBe(true);
    expect(lateEnemyKinds.has("brute")).toBe(true);
    expect(lateEnemyKinds.has("spitter")).toBe(true);
  });

  it("configures spitters as ranged projectile enemies", () => {
    const spitter = getEnemy("spitter");

    expect(spitter.projectileTexture).toBe("enemy-projectile-acid");
    expect(spitter.projectileDamage).toBeGreaterThan(0);
    expect(spitter.projectileCooldownMs).toBeGreaterThan(0);
    expect(spitter.preferredRange).toBeGreaterThan(100);
  });
});

describe("room data", () => {
  it("has spawn points, walls, barrels, and valid start positions", () => {
    for (const room of ROOMS) {
      expect(room.spawns.length).toBeGreaterThanOrEqual(4);
      expect(room.walls.length).toBeGreaterThan(4);
      expect(room.barrels.length).toBeGreaterThan(0);
      expect(room.playerStart.x).toBeGreaterThan(24);
      expect(room.playerStart.x).toBeLessThan(room.width - 24);
      expect(room.playerStart.y).toBeGreaterThan(24);
      expect(room.playerStart.y).toBeLessThan(room.height - 24);
      for (const spawn of room.spawns) {
        expect(spawn.x).toBeGreaterThanOrEqual(24);
        expect(spawn.x).toBeLessThanOrEqual(room.width - 24);
        expect(spawn.y).toBeGreaterThanOrEqual(24);
        expect(spawn.y).toBeLessThanOrEqual(room.height - 24);
      }
    }
  });
});

describe("projectile math", () => {
  it("creates a non-zero velocity from a shot angle", () => {
    const velocity = velocityFromAngle(0, 610);

    expect(velocity.x).toBeCloseTo(610);
    expect(velocity.y).toBeCloseTo(0);
  });

  it("spawns projectiles away from the player origin", () => {
    const spawn = spawnPointFromAngle({ x: 100, y: 100 }, Math.PI / 2, 28);

    expect(spawn.x).toBeCloseTo(100);
    expect(spawn.y).toBeCloseTo(128);
  });
});
