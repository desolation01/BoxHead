import type { Vector2 } from "./types";

export function velocityFromAngle(angle: number, speed: number): Vector2 {
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed
  };
}

export function spawnPointFromAngle(origin: Vector2, angle: number, distance: number): Vector2 {
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance
  };
}
