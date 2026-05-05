import type { Rect, Vector2 } from "./types";

interface SmartSteerInput {
  from: Vector2;
  target: Vector2;
  obstacles: Rect[];
  probeDistance: number;
}

const SIDE_PROBES = [0, -0.45, 0.45, -0.85, 0.85, -1.25, 1.25, Math.PI];

export function chooseSmartSteerAngle(input: SmartSteerInput): number {
  const direct = Math.atan2(input.target.y - input.from.y, input.target.x - input.from.x);
  const distance = Math.hypot(input.target.x - input.from.x, input.target.y - input.from.y);
  const probeDistance = Math.min(input.probeDistance, Math.max(24, distance));

  for (const offset of SIDE_PROBES) {
    const angle = direct + offset;
    const end = {
      x: input.from.x + Math.cos(angle) * probeDistance,
      y: input.from.y + Math.sin(angle) * probeDistance
    };
    if (!input.obstacles.some((obstacle) => segmentIntersectsRect(input.from, end, obstacle))) {
      return angle;
    }
  }

  return direct;
}

function segmentIntersectsRect(start: Vector2, end: Vector2, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;

  return (
    segmentsIntersect(start, end, { x: left, y: top }, { x: right, y: top }) ||
    segmentsIntersect(start, end, { x: right, y: top }, { x: right, y: bottom }) ||
    segmentsIntersect(start, end, { x: right, y: bottom }, { x: left, y: bottom }) ||
    segmentsIntersect(start, end, { x: left, y: bottom }, { x: left, y: top })
  );
}

function pointInRect(point: Vector2, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function segmentsIntersect(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const ab = orientation(a, b, c) * orientation(a, b, d);
  const cd = orientation(c, d, a) * orientation(c, d, b);
  return ab <= 0 && cd <= 0;
}

function orientation(a: Vector2, b: Vector2, c: Vector2): number {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}
