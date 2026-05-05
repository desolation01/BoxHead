import { describe, expect, it } from "vitest";
import type { StateSnapshot, PlayerState } from "../net/types";

describe("StateSnapshot shape", () => {
  it("accepts a valid snapshot", () => {
    const snapshot: StateSnapshot = {
      wave: 3,
      players: [{ id: 1, x: 100, y: 200, hp: 80, aimAngle: 0, weaponKey: "pistol", score: 400, dead: false, facingLeft: false }],
      enemies: [{ id: 7, x: 500, y: 300, hp: 10, kind: "shambler" }],
      boss: null,
      pickups: []
    };
    const player: PlayerState = snapshot.players[0]!;
    expect(player.id).toBe(1);
    expect(player.dead).toBe(false);
  });
});
