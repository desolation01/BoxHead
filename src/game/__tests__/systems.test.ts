import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getEnemy, pickEnemyForWave } from "../enemies";
import { spawnPointFromAngle, velocityFromAngle } from "../projectiles";
import { ROOMS } from "../rooms";
import { createWave } from "../waves";
import { getBestUnlockedWeapon, getUnlockedWeapons, STARTING_WEAPON, WEAPONS } from "../weapons";

describe("weapon progression", () => {
  it("starts with pistol and finite ammo for pickup weapons", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(STARTING_WEAPON.key).toBe("pistol");
    expect(WEAPONS.every((weapon) => Number.isFinite(weapon.maxAmmo))).toBe(true);
    expect(WEAPONS.filter((weapon) => weapon.key !== "pistol").every((weapon) => weapon.maxAmmo > weapon.clipPickup)).toBe(true);
    expect(gameScene).toContain("this.ammo = new Map(WEAPONS.map((weapon) => [weapon.key, 0]))");
    expect(gameScene).toContain("weaponAmmo - this.currentWeapon.ammoPerShot");
    expect(gameScene).toContain('this.currentWeapon.ammoPerShot === 0 ? "Ammo --"');
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

  it("keeps the current gun equipped after collecting a weapon pickup", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");
    const weaponPickupBranch = gameScene.match(/if \(pickup\.kind === "weapon" && pickup\.weaponKey\) \{[\s\S]*?\n    \}/)?.[0] ?? "";

    expect(weaponPickupBranch).toContain("this.addAmmo(weapon.key, weapon.clipPickup)");
    expect(weaponPickupBranch).not.toContain("this.equipWeapon");
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
  it("uses expanded arena dimensions", () => {
    for (const room of ROOMS) {
      expect(room.width).toBeGreaterThan(1440);
      expect(room.height).toBeGreaterThan(960);
    }
  });

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

  it("randomizes enemy spawns without drawing spawn marker boxes", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(gameScene).toContain("getRandomSpawnPoint");
    expect(gameScene).toContain("MIN_SPAWN_DISTANCE_FROM_PLAYER");
    expect(gameScene).toContain("getLivingPlayers()");
    expect(gameScene).not.toContain("this.add.rectangle(spawn.x, spawn.y, 42, 42");
    expect(gameScene).not.toContain("this.add.rectangle(spawn.x, spawn.y, 28, 28");
  });
});

describe("audio feedback", () => {
  it("creates generated sound effects and music without external assets", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(gameScene).toContain("startMusic");
    expect(gameScene).toContain("playSfx");
    expect(gameScene).toContain("AudioContext");
  });

  it("uses a distinct generated shot profile for every weapon", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(gameScene).toContain("WEAPON_SHOT_SFX");
    expect(gameScene).toContain("playWeaponShotSfx");
    for (const weapon of WEAPONS) {
      expect(gameScene).toContain(`${weapon.key}:`);
    }
  });
});

describe("camera framing", () => {
  it("zooms the camera in on desktop so the whole arena is not visible at once", () => {
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(gameScene).toContain("DESKTOP_CAMERA_ZOOM");
    expect(gameScene).toContain("const zoom = isMobileViewport ? (isPortrait ? PORTRAIT_CAMERA_ZOOM : MOBILE_CAMERA_ZOOM) : DESKTOP_CAMERA_ZOOM");
  });
});

describe("visual direction", () => {
  it("uses a bright block-arena look with beveled walls and red splatter decals", () => {
    const bootScene = readFileSync("src/game/scenes/BootScene.ts", "utf8");
    const gameScene = readFileSync("src/game/scenes/GameScene.ts", "utf8");

    expect(bootScene).toContain("0xe7dcc7");
    expect(bootScene).toContain("makeBoxheadBlock");
    expect(bootScene).toContain("0xb0172b");
    expect(gameScene).toContain("drawBeveledWallBlock");
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
