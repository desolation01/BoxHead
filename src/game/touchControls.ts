export type TouchControlSide = "move" | "aim";

export function getTouchControlSide(clientX: number, viewportWidth: number): TouchControlSide {
  return clientX < viewportWidth / 2 ? "move" : "aim";
}

export function clampTouchStickCenter(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  radius: number
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(clientX, radius), Math.max(radius, viewportWidth - radius)),
    y: Math.min(Math.max(clientY, radius), Math.max(radius, viewportHeight - radius))
  };
}
