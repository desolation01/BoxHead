import type { WeaponKey } from "./types";

export function getWeaponPickupTexture(weaponKey: WeaponKey): string {
  return `pickup-weapon-${weaponKey}`;
}

export function getAmmoPickupTexture(weaponKey: WeaponKey): string {
  return `pickup-ammo-${weaponKey}`;
}
