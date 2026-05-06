import Phaser from "phaser";
import { getAmmoPickupTexture, getWeaponPickupTexture } from "../pickups";
import type { WeaponKey } from "../types";
import { WEAPONS } from "../weapons";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.makeFloorTile();
    this.makeConcreteWall();
    this.makePlayer();
    this.makePlayerWeapons();
    this.makeZombie("enemy-shambler", 0x78a85a, 0x3f5a34, 0x5b5648);
    this.makeZombie("enemy-shambler-hit", 0xded88a, 0x7c6d36, 0x7a4236);
    this.makeZombie("enemy-runner", 0xa4c957, 0x5d7333, 0x55503f);
    this.makeZombie("enemy-runner-hit", 0xf0df83, 0x8a7737, 0x794539);
    this.makeZombie("enemy-brute", 0x9b7658, 0x5f3f34, 0x6a4336);
    this.makeZombie("enemy-brute-hit", 0xe4b36f, 0x8d5c3d, 0x7c372f);
    this.makeZombie("enemy-spitter", 0x6bc395, 0x327b5d, 0x404f47);
    this.makeZombie("enemy-spitter-hit", 0xb4e3a5, 0x60864d, 0x5d4a33);
    this.makeBoss("boss-butcher", 0x8f3f36, 0x4a1d1a, 0x6b6655);
    this.makeBoss("boss-butcher-hit", 0xd99157, 0x7a2d25, 0x8f7a51);
    this.makeBullet();
    this.makeEnemyProjectiles();
    this.makeBarricade();
    this.makeBarrel();
    this.makePickup("pickup-health", 0xd84a4a, 0xffffff, "cross");
    this.makePickup("pickup-ammo", 0x4996d8, 0xd7efff, "rounds");
    this.makePickup("pickup-weapon", 0xe1b652, 0x2a2210, "gun");
    this.makeWeaponPickupIcons();
    this.makeDecals();
    this.scene.start("MenuScene");
  }

  private makeFloorTile(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xe7dcc7, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.lineStyle(1, 0xd8ccb6, 0.5);
    graphics.strokeRect(0.5, 0.5, 63, 63);
    graphics.fillStyle(0xd8cbb5, 0.42);
    graphics.fillEllipse(12, 48, 26, 10);
    graphics.fillEllipse(49, 15, 18, 8);
    graphics.fillStyle(0xf2eadc, 0.38);
    graphics.fillEllipse(32, 34, 20, 7);
    graphics.generateTexture("floor-tile", 64, 64);
    graphics.destroy();
  }

  private makeConcreteWall(): void {
    const graphics = this.add.graphics();
    this.makeBoxheadBlock(graphics, 0, 0, 48, 48);
    graphics.generateTexture("wall", 48, 48);
    graphics.destroy();
  }

  private makeBoxheadBlock(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
    const bevel = Math.min(12, width * 0.22, height * 0.22);
    graphics.fillStyle(0x111111, 0.22);
    graphics.fillRect(x + 4, y + 5, width, height);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillPoints([
      new Phaser.Geom.Point(x + bevel, y),
      new Phaser.Geom.Point(x + width - bevel, y),
      new Phaser.Geom.Point(x + width, y + bevel),
      new Phaser.Geom.Point(x + width, y + height * 0.58),
      new Phaser.Geom.Point(x, y + height * 0.58),
      new Phaser.Geom.Point(x, y + bevel)
    ], true);
    graphics.fillStyle(0x8b8b86, 1);
    graphics.fillPoints([
      new Phaser.Geom.Point(x, y + height * 0.58),
      new Phaser.Geom.Point(x + width, y + height * 0.58),
      new Phaser.Geom.Point(x + width, y + height),
      new Phaser.Geom.Point(x, y + height)
    ], true);
    graphics.lineStyle(2, 0x111111, 0.9);
    graphics.strokePoints([
      new Phaser.Geom.Point(x + bevel, y),
      new Phaser.Geom.Point(x + width - bevel, y),
      new Phaser.Geom.Point(x + width, y + bevel),
      new Phaser.Geom.Point(x + width, y + height),
      new Phaser.Geom.Point(x, y + height),
      new Phaser.Geom.Point(x, y + bevel)
    ], true);
  }

  private makePlayer(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x080808, 0.35);
    graphics.fillEllipse(22, 28, 36, 16);
    graphics.fillStyle(0x9d9687, 1);
    graphics.fillRect(10, 13, 24, 20);
    graphics.fillStyle(0xe1d4bd, 1);
    graphics.fillRect(12, 6, 20, 15);
    graphics.fillStyle(0x2c2925, 1);
    graphics.fillRect(12, 4, 20, 6);
    graphics.fillStyle(0x303030, 1);
    graphics.fillRect(27, 16, 22, 7);
    graphics.fillStyle(0x111111, 1);
    graphics.fillRect(46, 18, 9, 3);
    graphics.fillStyle(0x383a40, 1);
    graphics.fillRect(12, 30, 8, 8);
    graphics.fillRect(25, 30, 8, 8);
    graphics.lineStyle(2, 0x171717, 1);
    graphics.strokeRect(10, 13, 24, 20);
    graphics.generateTexture("player", 54, 40);
    graphics.destroy();
  }

  private makePlayerWeapons(): void {
    this.makeHeldWeapon("player-weapon-pistol", 34, 16, 0x4c4b41, 0xf1d27a, "pistol");
    this.makeHeldWeapon("player-weapon-magnum", 40, 18, 0x3b3a34, 0xf7d77c, "magnum");
    this.makeHeldWeapon("player-weapon-shotgun", 54, 18, 0x5a3b24, 0xff9f43, "shotgun");
    this.makeHeldWeapon("player-weapon-ak47", 52, 18, 0x4e3b24, 0xe8c36a, "ak47");
    this.makeHeldWeapon("player-weapon-uzi", 38, 18, 0x2f4335, 0xa7f070, "uzi");
    this.makeHeldWeapon("player-weapon-crossbow", 50, 22, 0x4b3220, 0xd7f3b0, "crossbow");
    this.makeHeldWeapon("player-weapon-flameBurst", 46, 20, 0x653224, 0xff6f2a, "flame");
    this.makeHeldWeapon("player-weapon-barrelLauncher", 56, 24, 0x55322a, 0xf25b38, "launcher");
    this.makeHeldWeapon("player-weapon-railBurst", 58, 18, 0x264559, 0x73d9ff, "rail");
    this.makeHeldWeapon("player-weapon-minigun", 58, 22, 0x4e5556, 0xc8d2d4, "minigun");
  }

  private makeHeldWeapon(key: string, width: number, height: number, body: number, accent: number, variant: string): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0d0d0b, 1);
    graphics.fillRect(0, Math.floor(height / 2) - 4, width - 2, 8);
    graphics.fillStyle(body, 1);
    graphics.fillRect(2, Math.floor(height / 2) - 6, width - 12, 6);
    graphics.fillStyle(0x22221d, 1);
    graphics.fillRect(10, Math.floor(height / 2) + 3, 8, 6);
    graphics.fillStyle(accent, 1);
    graphics.fillRect(width - 10, Math.floor(height / 2) - 5, 7, 4);

    if (variant === "shotgun") {
      graphics.fillStyle(0x2b1d15, 1);
      graphics.fillRect(width - 18, Math.floor(height / 2) + 2, 14, 3);
    } else if (variant === "ak47") {
      graphics.fillStyle(0x2b1d15, 1);
      graphics.fillRect(12, Math.floor(height / 2) - 9, 18, 4);
      graphics.fillStyle(0x181711, 1);
      graphics.fillRect(23, Math.floor(height / 2) + 5, 7, 10);
      graphics.fillRect(width - 15, Math.floor(height / 2) - 3, 11, 3);
    } else if (variant === "uzi") {
      graphics.fillStyle(0x151713, 1);
      graphics.fillRect(19, Math.floor(height / 2) + 6, 6, 8);
    } else if (variant === "crossbow") {
      graphics.lineStyle(2, accent, 1);
      graphics.lineBetween(width - 17, 2, width - 4, Math.floor(height / 2));
      graphics.lineBetween(width - 17, height - 3, width - 4, Math.floor(height / 2));
      graphics.lineStyle(1, 0x120f0b, 0.85);
      graphics.lineBetween(width - 18, 2, width - 18, height - 3);
      graphics.fillStyle(accent, 1);
      graphics.fillRect(width - 7, Math.floor(height / 2) - 2, 5, 4);
    } else if (variant === "flame") {
      graphics.fillStyle(0xffaa3b, 0.9);
      graphics.fillRect(width - 20, Math.floor(height / 2) + 4, 11, 5);
      graphics.fillStyle(0x7c1f16, 1);
      graphics.fillRect(5, Math.floor(height / 2) - 8, 10, 4);
    } else if (variant === "launcher") {
      graphics.fillStyle(0x1b1714, 1);
      graphics.fillRect(width - 30, Math.floor(height / 2) - 8, 21, 16);
      graphics.fillStyle(accent, 1);
      graphics.fillRect(width - 27, Math.floor(height / 2) - 5, 14, 10);
    } else if (variant === "rail") {
      graphics.fillStyle(0x9eeaff, 1);
      graphics.fillRect(8, Math.floor(height / 2) - 8, width - 18, 2);
      graphics.fillRect(8, Math.floor(height / 2) + 6, width - 18, 2);
    } else if (variant === "minigun") {
      graphics.fillStyle(0x202526, 1);
      graphics.fillRect(width - 26, Math.floor(height / 2) - 8, 18, 3);
      graphics.fillRect(width - 26, Math.floor(height / 2) - 3, 18, 3);
      graphics.fillRect(width - 26, Math.floor(height / 2) + 2, 18, 3);
      graphics.fillStyle(accent, 1);
      graphics.fillRect(width - 8, Math.floor(height / 2) - 7, 5, 13);
    } else if (variant === "magnum") {
      graphics.fillStyle(0x11110e, 1);
      graphics.fillRect(width - 14, Math.floor(height / 2) - 3, 10, 4);
    }

    graphics.fillStyle(0x8e3329, 1);
    graphics.fillRect(4, Math.floor(height / 2) + 4, 8, 4);
    graphics.lineStyle(1, 0x0a0a08, 0.75);
    graphics.strokeRect(1, Math.floor(height / 2) - 7, width - 8, 10);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private makeZombie(key: string, skin: number, darkSkin: number, clothes: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x080808, 0.34);
    graphics.fillEllipse(20, 28, 34, 15);
    graphics.fillStyle(clothes, 1);
    graphics.fillRect(9, 13, 24, 20);
    graphics.fillStyle(skin, 1);
    graphics.fillRect(12, 6, 18, 14);
    graphics.fillStyle(0x1b1b1b, 1);
    graphics.fillRect(12, 4, 18, 5);
    graphics.fillStyle(darkSkin, 1);
    graphics.fillRect(7, 17, 8, 6);
    graphics.fillRect(29, 17, 8, 6);
    graphics.fillStyle(0x2a2b2c, 1);
    graphics.fillRect(12, 31, 7, 7);
    graphics.fillRect(24, 31, 7, 7);
    graphics.fillStyle(0xb0172b, 0.9);
    graphics.fillRect(10, 24, 9, 3);
    graphics.fillRect(25, 16, 5, 3);
    graphics.lineStyle(2, 0x111111, 1);
    graphics.strokeRect(9, 13, 24, 20);
    graphics.generateTexture(key, 42, 40);
    graphics.destroy();
  }

  private makeBoss(key: string, skin: number, darkSkin: number, clothes: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x10100d, 0.38);
    graphics.fillEllipse(36, 52, 74, 30);
    graphics.fillStyle(clothes, 1);
    graphics.fillRect(14, 18, 48, 46);
    graphics.fillStyle(skin, 1);
    graphics.fillRect(20, 5, 36, 28);
    graphics.fillStyle(darkSkin, 1);
    graphics.fillRect(7, 28, 16, 16);
    graphics.fillRect(54, 28, 16, 16);
    graphics.fillStyle(0x241511, 1);
    graphics.fillRect(20, 62, 15, 16);
    graphics.fillRect(44, 62, 15, 16);
    graphics.fillStyle(0x11110d, 1);
    graphics.fillRect(28, 15, 5, 5);
    graphics.fillRect(45, 15, 5, 5);
    graphics.fillStyle(0xc04432, 0.9);
    graphics.fillRect(15, 42, 16, 5);
    graphics.fillRect(42, 32, 15, 5);
    graphics.lineStyle(4, 0x11110d, 1);
    graphics.strokeRect(14, 18, 48, 46);
    graphics.lineStyle(2, 0xd9b65f, 1);
    graphics.strokeRect(20, 5, 36, 28);
    graphics.generateTexture(key, 80, 84);
    graphics.destroy();
  }

  private makeBullet(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xfff6b2, 1);
    graphics.fillRect(0, 1, 16, 4);
    graphics.fillStyle(0xffb247, 1);
    graphics.fillRect(0, 5, 10, 2);
    graphics.fillStyle(0xffffff, 0.65);
    graphics.fillRect(10, 0, 5, 2);
    graphics.generateTexture("bullet", 16, 8);
    graphics.destroy();
  }

  private makeEnemyProjectiles(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0e2519, 0.35);
    graphics.fillEllipse(13, 9, 22, 12);
    graphics.fillStyle(0x6ee28e, 1);
    graphics.fillEllipse(12, 8, 18, 12);
    graphics.fillStyle(0xd7ffd3, 0.9);
    graphics.fillEllipse(16, 5, 6, 4);
    graphics.fillStyle(0x2c8f5d, 0.9);
    graphics.fillEllipse(7, 11, 7, 5);
    graphics.generateTexture("enemy-projectile-acid", 26, 18);
    graphics.destroy();
  }

  private makeBarricade(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x3a2217, 1);
    graphics.fillRect(0, 0, 54, 20);
    graphics.fillStyle(0x91613a, 1);
    graphics.fillRect(2, 2, 50, 5);
    graphics.fillRect(2, 13, 50, 5);
    graphics.fillStyle(0x6c4328, 1);
    graphics.fillRect(8, 7, 7, 6);
    graphics.fillRect(34, 7, 7, 6);
    graphics.lineStyle(2, 0x24150f, 1);
    graphics.strokeRect(1, 1, 52, 18);
    graphics.generateTexture("barricade", 54, 20);
    graphics.destroy();
  }

  private makeBarrel(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x111111, 0.28);
    graphics.fillEllipse(20, 27, 34, 14);
    graphics.fillStyle(0x9f9f9b, 1);
    graphics.fillRect(6, 8, 28, 20);
    graphics.fillStyle(0xd7d7d2, 1);
    graphics.fillEllipse(20, 8, 28, 12);
    graphics.fillStyle(0x343434, 1);
    graphics.fillEllipse(20, 6, 22, 9);
    graphics.fillStyle(0xb0172b, 1);
    graphics.fillRect(6, 19, 28, 4);
    graphics.lineStyle(2, 0x242424, 1);
    graphics.strokeEllipse(20, 8, 28, 12);
    graphics.strokeRect(6, 8, 28, 20);
    graphics.generateTexture("barrel", 40, 38);
    graphics.destroy();
  }

  private makePickup(key: string, fill: number, mark: number, icon: "cross" | "rounds" | "gun"): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x090908, 0.35);
    graphics.fillEllipse(15, 18, 24, 10);
    graphics.fillStyle(fill, 1);
    graphics.fillRect(4, 3, 23, 23);
    graphics.lineStyle(2, 0x11110d, 1);
    graphics.strokeRect(4, 3, 23, 23);
    graphics.fillStyle(mark, 1);
    if (icon === "cross") {
      graphics.fillRect(13, 7, 5, 15);
      graphics.fillRect(8, 12, 15, 5);
    } else if (icon === "rounds") {
      graphics.fillRect(9, 8, 4, 12);
      graphics.fillRect(15, 8, 4, 12);
      graphics.fillRect(21, 8, 3, 12);
    } else {
      graphics.fillRect(8, 12, 14, 5);
      graphics.fillRect(18, 9, 5, 4);
      graphics.fillRect(11, 17, 4, 5);
    }
    graphics.generateTexture(key, 32, 30);
    graphics.destroy();
  }

  private makeWeaponPickupIcons(): void {
    for (const weapon of WEAPONS) {
      this.makeWeaponPickupIcon(getWeaponPickupTexture(weapon.key), weapon.key, 0xe1b652, weapon.color, true);
      this.makeWeaponPickupIcon(getAmmoPickupTexture(weapon.key), weapon.key, 0x3b86d1, weapon.color, false);
    }
  }

  private makeWeaponPickupIcon(key: string, weaponKey: WeaponKey, fill: number, accent: number, isWeapon: boolean): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x090908, 0.35);
    graphics.fillEllipse(20, 27, 32, 12);
    graphics.fillStyle(fill, 1);
    graphics.fillRoundedRect(2, 2, 36, 36, 5);
    graphics.lineStyle(3, isWeapon ? 0xfff2c9 : 0xb7e9ff, 1);
    graphics.strokeRoundedRect(2, 2, 36, 36, 5);
    graphics.fillStyle(isWeapon ? 0x1d160d : 0x08192a, 1);
    graphics.fillRoundedRect(6, 7, 28, 24, 3);
    this.drawWeaponSignature(graphics, weaponKey, accent, isWeapon);
    this.drawWeaponGlyph(graphics, weaponKey, isWeapon);
    graphics.generateTexture(key, 40, 40);
    graphics.destroy();
  }

  private drawWeaponGlyph(graphics: Phaser.GameObjects.Graphics, weaponKey: WeaponKey, isWeapon: boolean): void {
    if (!isWeapon) {
      graphics.fillStyle(0xdaf3ff, 1);
      graphics.fillRect(8, 11, 3, 12);
      graphics.fillRect(12, 9, 3, 14);
      graphics.fillRect(16, 11, 3, 12);
      graphics.fillStyle(0x9ecce8, 1);
      graphics.fillRect(8, 8, 3, 2);
      graphics.fillRect(12, 6, 3, 2);
      graphics.fillRect(16, 8, 3, 2);
    }

    graphics.fillStyle(isWeapon ? 0xffffff : 0xa9f0ff, 1);
    const offsetX = isWeapon ? 0 : 8;
    const offsetY = isWeapon ? 0 : 2;

    switch (weaponKey) {
      case "pistol":
        graphics.fillRect(10 + offsetX, 14 + offsetY, 11, 4);
        graphics.fillRect(17 + offsetX, 12 + offsetY, 3, 3);
        graphics.fillRect(12 + offsetX, 18 + offsetY, 3, 5);
        break;
      case "magnum":
        graphics.fillRect(9 + offsetX, 14 + offsetY, 13, 4);
        graphics.fillRect(19 + offsetX, 11 + offsetY, 3, 3);
        graphics.fillRect(12 + offsetX, 18 + offsetY, 4, 6);
        break;
      case "shotgun":
        graphics.fillRect(8 + offsetX, 13 + offsetY, 14, 3);
        graphics.fillRect(9 + offsetX, 17 + offsetY, 11, 2);
        graphics.fillRect(18 + offsetX, 11 + offsetY, 4, 3);
        break;
      case "ak47":
        graphics.fillRect(8 + offsetX, 13 + offsetY, 13, 3);
        graphics.fillRect(10 + offsetX, 17 + offsetY, 4, 6);
        graphics.fillRect(18 + offsetX, 10 + offsetY, 2, 4);
        break;
      case "uzi":
        graphics.fillRect(10 + offsetX, 12 + offsetY, 10, 4);
        graphics.fillRect(12 + offsetX, 16 + offsetY, 3, 7);
        graphics.fillRect(18 + offsetX, 14 + offsetY, 3, 2);
        break;
      case "crossbow":
        graphics.fillRect(10 + offsetX, 15 + offsetY, 11, 2);
        graphics.fillTriangle(11 + offsetX, 10 + offsetY, 11 + offsetX, 22 + offsetY, 7 + offsetX, 16 + offsetY);
        graphics.fillTriangle(20 + offsetX, 10 + offsetY, 20 + offsetX, 22 + offsetY, 24 + offsetX, 16 + offsetY);
        break;
      case "flameBurst":
        graphics.fillRect(9 + offsetX, 16 + offsetY, 10, 3);
        graphics.fillTriangle(18 + offsetX, 10 + offsetY, 24 + offsetX, 16 + offsetY, 18 + offsetX, 22 + offsetY);
        break;
      case "barrelLauncher":
        graphics.fillRect(8 + offsetX, 13 + offsetY, 13, 6);
        graphics.fillRect(10 + offsetX, 19 + offsetY, 3, 4);
        graphics.fillCircle(20 + offsetX, 16 + offsetY, 2.5);
        break;
      case "railBurst":
        graphics.fillRect(7 + offsetX, 14 + offsetY, 15, 2);
        graphics.fillRect(7 + offsetX, 19 + offsetY, 15, 2);
        graphics.fillRect(10 + offsetX, 11 + offsetY, 3, 12);
        break;
      case "minigun":
        graphics.fillRect(8 + offsetX, 12 + offsetY, 13, 3);
        graphics.fillRect(8 + offsetX, 16 + offsetY, 13, 3);
        graphics.fillRect(8 + offsetX, 20 + offsetY, 13, 2);
        graphics.fillCircle(22 + offsetX, 17 + offsetY, 2);
        break;
    }
  }

  private drawWeaponSignature(graphics: Phaser.GameObjects.Graphics, weaponKey: WeaponKey, accent: number, isWeapon: boolean): void {
    const index = WEAPONS.findIndex((weapon) => weapon.key === weaponKey);
    const pips = (index % 3) + 1;
    graphics.fillStyle(accent, 1);
    for (let i = 0; i < pips; i += 1) {
      graphics.fillRect(8 + i * 8, 5, 5, 2);
    }
    if (!isWeapon) {
      graphics.fillStyle(0x72b8e8, 1);
      graphics.fillRect(23, 11, 8, 13);
      graphics.lineStyle(1, 0xe8f6ff, 1);
      graphics.strokeRect(23, 11, 8, 13);
    }
  }

  private makeDecals(): void {
    this.makeCrate();
    this.makeCrack();
    this.makeStain();
    this.makeVent();
    this.makeMuzzleFlash();
  }

  private makeCrate(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x111111, 0.22);
    graphics.fillRect(5, 7, 32, 26);
    graphics.fillStyle(0xe2371b, 1);
    graphics.fillRect(0, 3, 34, 24);
    graphics.fillStyle(0xff5638, 1);
    graphics.fillRect(3, 0, 28, 7);
    graphics.lineStyle(2, 0x7d160c, 1);
    graphics.strokeRect(0, 3, 34, 24);
    graphics.generateTexture("prop-crate", 38, 38);
    graphics.destroy();
  }

  private makeCrack(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x12120f, 0.65);
    graphics.lineBetween(4, 18, 16, 12);
    graphics.lineBetween(16, 12, 28, 16);
    graphics.lineBetween(18, 14, 18, 26);
    graphics.lineBetween(28, 16, 38, 10);
    graphics.generateTexture("decal-crack", 44, 34);
    graphics.destroy();
  }

  private makeStain(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xb0172b, 0.72);
    graphics.fillEllipse(38, 28, 70, 28);
    graphics.fillEllipse(20, 42, 42, 16);
    graphics.fillEllipse(62, 15, 24, 12);
    graphics.fillEllipse(78, 34, 18, 10);
    graphics.fillStyle(0x7e0d20, 0.55);
    graphics.fillEllipse(48, 31, 46, 15);
    graphics.fillCircle(9, 25, 4);
    graphics.fillCircle(87, 18, 3);
    graphics.generateTexture("decal-stain", 96, 60);
    graphics.destroy();
  }

  private makeVent(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x1f2124, 1);
    graphics.fillRect(0, 0, 42, 26);
    graphics.fillStyle(0xd7d7d2, 1);
    graphics.fillRect(3, 3, 36, 20);
    graphics.lineStyle(2, 0x111111, 1);
    for (let x = 8; x < 36; x += 7) {
      graphics.lineBetween(x, 5, x - 5, 22);
    }
    graphics.generateTexture("prop-vent", 42, 26);
    graphics.destroy();
  }

  private makeMuzzleFlash(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xfff0a0, 1);
    graphics.fillTriangle(0, 6, 22, 0, 16, 6);
    graphics.fillTriangle(0, 6, 22, 12, 16, 6);
    graphics.fillStyle(0xff8b2f, 0.8);
    graphics.fillTriangle(2, 6, 14, 2, 12, 6);
    graphics.fillTriangle(2, 6, 14, 10, 12, 6);
    graphics.generateTexture("muzzle-flash", 24, 14);
    graphics.destroy();
  }
}
