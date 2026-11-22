/** A fresh 32-bit seed for a new game (D-033). Tests and replays pass fixed seeds instead. */
export function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] ?? 1;
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}
