import type { WeaponDefinition, WeaponKey } from "./types";

export const WEAPONS: WeaponDefinition[] = [
  {
    key: "pistol",
    label: "Pistol",
    unlockScore: 0,
    fireRateMs: 230,
    bulletSpeed: 610,
    damage: 1,
    spread: 0,
    pellets: 1,
    ammoPerShot: 0,
    clipPickup: 0,
    maxAmmo: 0,
    color: 0xf4e3a2,
    pierce: 0
  },
  {
    key: "magnum",
    label: "Magnum",
    unlockScore: 360,
    fireRateMs: 420,
    bulletSpeed: 760,
    damage: 2,
    spread: 0.01,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 28,
    maxAmmo: 56,
    color: 0xf7d77c,
    pierce: 1,
    knockback: 120
  },
  {
    key: "shotgun",
    label: "Shotgun",
    unlockScore: 700,
    fireRateMs: 620,
    bulletSpeed: 560,
    damage: 1,
    spread: 0.26,
    pellets: 6,
    ammoPerShot: 1,
    clipPickup: 18,
    maxAmmo: 36,
    color: 0xff9f43,
    pierce: 0,
    knockback: 170
  },
  {
    key: "ak47",
    label: "AK-47",
    unlockScore: 1150,
    fireRateMs: 118,
    bulletSpeed: 720,
    damage: 1,
    spread: 0.045,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 54,
    maxAmmo: 180,
    color: 0xe8c36a,
    pierce: 1,
    knockback: 55
  },
  {
    key: "uzi",
    label: "Uzi",
    unlockScore: 1600,
    fireRateMs: 82,
    bulletSpeed: 680,
    damage: 1,
    spread: 0.08,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 70,
    maxAmmo: 210,
    color: 0xa7f070,
    pierce: 0
  },
  {
    key: "crossbow",
    label: "Crossbow",
    unlockScore: 2100,
    fireRateMs: 540,
    bulletSpeed: 690,
    damage: 3,
    spread: 0,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 22,
    maxAmmo: 44,
    color: 0xd7f3b0,
    pierce: 4,
    knockback: 95
  },
  {
    key: "flameBurst",
    label: "Flame Burst",
    unlockScore: 2500,
    fireRateMs: 120,
    bulletSpeed: 360,
    damage: 1,
    spread: 0.18,
    pellets: 2,
    ammoPerShot: 1,
    clipPickup: 55,
    maxAmmo: 165,
    color: 0xff6f2a,
    flameRadius: 34,
    pierce: 1
  },
  {
    key: "barrelLauncher",
    label: "Launcher",
    unlockScore: 3300,
    fireRateMs: 780,
    bulletSpeed: 420,
    damage: 4,
    spread: 0.02,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 8,
    maxAmmo: 16,
    color: 0xf25b38,
    explosiveRadius: 88,
    pierce: 0
  },
  {
    key: "railBurst",
    label: "Rail Burst",
    unlockScore: 5600,
    fireRateMs: 360,
    bulletSpeed: 830,
    damage: 2,
    spread: 0.04,
    pellets: 3,
    ammoPerShot: 1,
    clipPickup: 20,
    maxAmmo: 40,
    color: 0x73d9ff,
    pierce: 3
  },
  {
    key: "minigun",
    label: "Minigun",
    unlockScore: 7900,
    fireRateMs: 48,
    bulletSpeed: 760,
    damage: 1,
    spread: 0.11,
    pellets: 1,
    ammoPerShot: 1,
    clipPickup: 120,
    maxAmmo: 360,
    color: 0xc8d2d4,
    pierce: 1,
    knockback: 80
  }
];

export const STARTING_WEAPON: WeaponDefinition = getWeapon("pistol");

export function getWeapon(key: WeaponKey): WeaponDefinition {
  const weapon = WEAPONS.find((candidate) => candidate.key === key);
  if (!weapon) {
    throw new Error(`Unknown weapon: ${key}`);
  }
  return weapon;
}

export function getUnlockedWeapons(score: number): WeaponDefinition[] {
  return WEAPONS.filter((weapon) => score >= weapon.unlockScore);
}

export function getBestUnlockedWeapon(score: number): WeaponDefinition {
  return getUnlockedWeapons(score).at(-1) ?? STARTING_WEAPON;
}

export function getNextUsableWeapon(currentKey: WeaponKey, score: number, ammoForWeapon: (key: WeaponKey) => number): WeaponDefinition {
  const usableWeapons = getUnlockedWeapons(score).filter((weapon) => weapon.key === "pistol" || ammoForWeapon(weapon.key) > 0);
  if (usableWeapons.length === 0) {
    return STARTING_WEAPON;
  }

  const currentIndex = usableWeapons.findIndex((weapon) => weapon.key === currentKey);
  return usableWeapons[(currentIndex + 1) % usableWeapons.length] ?? usableWeapons[0];
}
