/**
 * Seeded RNG (mulberry32). The generator state is one uint32 stored in GameState, so every
 * random decision is reproducible and saved with the game.
 */
export interface RngState {
  rng: number;
}

/** Next float in [0, 1). Advances `s.rng`. */
export function rngNext(s: RngState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function rngInt(s: RngState, min: number, max: number): number {
  return min + Math.floor(rngNext(s) * (max - min + 1));
}

/** Uniformly picks an element; the array must be non-empty. */
export function rngPick<T>(s: RngState, items: readonly T[]): T {
  const item = items[rngInt(s, 0, items.length - 1)];
  if (item === undefined) throw new Error('rngPick: empty array');
  return item;
}
