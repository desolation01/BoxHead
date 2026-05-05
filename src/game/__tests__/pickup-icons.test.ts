import { describe, expect, it } from "vitest";
import { getAmmoPickupTexture, getWeaponPickupTexture } from "../pickups";
import type { WeaponKey } from "../types";
import { WEAPONS } from "../weapons";

describe("weapon pickup icons", () => {
  it("uses a distinct weapon and ammo icon key for every weapon including pistol", () => {
    const weaponKeys = WEAPONS.map((weapon) => weapon.key) as WeaponKey[];
    const weaponTextures = weaponKeys.map(getWeaponPickupTexture);
    const ammoTextures = weaponKeys.map(getAmmoPickupTexture);

    expect(new Set(weaponTextures).size).toBe(weaponKeys.length);
    expect(new Set(ammoTextures).size).toBe(weaponKeys.length);
    expect(weaponTextures).toContain("pickup-weapon-pistol");
    expect(ammoTextures).toContain("pickup-ammo-pistol");
    expect(weaponTextures).toContain("pickup-weapon-shotgun");
    expect(ammoTextures).toContain("pickup-ammo-shotgun");
  });
});
