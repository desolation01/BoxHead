import { describe, expect, it } from "vitest";
import { chooseSmartSteerAngle } from "../pathfinding";

describe("enemy steering avoidance", () => {
  it("sidesteps an obstacle that blocks direct movement toward the player", () => {
    const angle = chooseSmartSteerAngle({
      from: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      obstacles: [{ x: 24, y: -16, width: 28, height: 32 }],
      probeDistance: 64
    });

    expect(Math.abs(angle)).toBeGreaterThan(0.2);
    expect(Math.abs(angle)).toBeLessThan(Math.PI / 1.8);
  });

  it("keeps direct movement when the lane is open", () => {
    const angle = chooseSmartSteerAngle({
      from: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      obstacles: [{ x: 24, y: 30, width: 28, height: 32 }],
      probeDistance: 64
    });

    expect(angle).toBeCloseTo(0);
  });
});
