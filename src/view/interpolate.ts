import type { Point } from './iso';

/** Position between the previous and current tick positions; `alpha` is clamped to 0..1. */
export function interpolatePosition(
  c: { prevX: number; prevY: number; x: number; y: number },
  alpha: number,
): Point {
  const a = Math.min(1, Math.max(0, alpha));
  return { x: c.prevX + (c.x - c.prevX) * a, y: c.prevY + (c.y - c.prevY) * a };
}
