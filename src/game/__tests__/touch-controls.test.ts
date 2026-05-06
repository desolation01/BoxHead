import { describe, expect, it } from "vitest";
import { clampTouchStickCenter, getTouchControlSide } from "../touchControls";

describe("floating touch controls", () => {
  it("routes left-screen touches to movement and right-screen touches to aiming", () => {
    expect(getTouchControlSide(10, 400)).toBe("move");
    expect(getTouchControlSide(199, 400)).toBe("move");
    expect(getTouchControlSide(200, 400)).toBe("aim");
    expect(getTouchControlSide(390, 400)).toBe("aim");
  });

  it("keeps the floating stick centered inside the viewport", () => {
    expect(clampTouchStickCenter(8, 30, 400, 240, 52)).toEqual({ x: 52, y: 52 });
    expect(clampTouchStickCenter(390, 230, 400, 240, 52)).toEqual({ x: 348, y: 188 });
    expect(clampTouchStickCenter(180, 120, 400, 240, 52)).toEqual({ x: 180, y: 120 });
  });
});
