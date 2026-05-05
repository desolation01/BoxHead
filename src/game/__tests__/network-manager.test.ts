import { describe, expect, it } from "vitest";
import { NetworkManager } from "../net/NetworkManager";

describe("NetworkManager input queue", () => {
  it("keeps only latest input per player", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false, weaponKey: "pistol" });
    manager.enqueueInput({ playerId: 2, keys: { up: false, down: true, left: false, right: false }, aimAngle: 1.0, shooting: true, weaponKey: "shotgun" });
    const drained = manager.drainInputs();
    expect(drained).toHaveLength(1);
    expect(drained[0]!.keys.down).toBe(true);
    expect(drained[0]!.aimAngle).toBe(1.0);
    expect(drained[0]!.weaponKey).toBe("shotgun");
  });

  it("tracks multiple players independently", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false, weaponKey: "pistol" });
    manager.enqueueInput({ playerId: 3, keys: { up: false, down: true, left: false, right: false }, aimAngle: 0.5, shooting: false, weaponKey: "magnum" });
    expect(manager.drainInputs()).toHaveLength(2);
  });

  it("returns empty array after draining", () => {
    const manager = new NetworkManager();
    manager.enqueueInput({ playerId: 2, keys: { up: true, down: false, left: false, right: false }, aimAngle: 0, shooting: false, weaponKey: "pistol" });
    manager.drainInputs();
    expect(manager.drainInputs()).toHaveLength(0);
  });
});
