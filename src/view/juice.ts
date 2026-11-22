/** Pure animation curves for the juice pass (M10). No Phaser, so they are unit tested. */

/** Coin popup: total rise (px) and the small overshoot bounce (px). */
export const COIN_RISE_PX = 16;
export const COIN_BOUNCE_PX = 3;

/** Emote squash and stretch: [progress 0..1, scaleX, scaleY] keyframes of the pop-in. */
export const EMOTE_SQUASH: readonly (readonly [number, number, number])[] = [
  [0, 0.5, 0.5],
  [0.4, 1.25, 0.75],
  [0.7, 0.9, 1.15],
  [1, 1, 1],
];

/** Squash-and-stretch scale (x, y) at pop progress k (0..1), interpolated between keyframes. */
export function squash(k: number): [number, number] {
  const frames = EMOTE_SQUASH;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    if (!a || !b || k > b[0]) continue;
    const f = b[0] === a[0] ? 1 : (k - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  return [1, 1];
}

/** Height (px) of the coin popup at progress k (0..1): quick rise, small overshoot, settle. */
export function coinRise(k: number): number {
  const base = COIN_RISE_PX * (1 - Math.pow(1 - k, 3));
  const bounce = COIN_BOUNCE_PX * Math.sin(k * Math.PI * 2.5) * (1 - k);
  return Math.round(base + bounce);
}
