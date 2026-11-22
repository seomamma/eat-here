import { describe, expect, it } from 'vitest';
import { randomSeed } from '../../src/platform/seed';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';

describe('randomSeed', () => {
  it('returns uint32 seeds that differ between calls', () => {
    const seeds = new Set(Array.from({ length: 20 }, () => randomSeed()));
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
    expect(seeds.size).toBeGreaterThan(15);
  });

  it('different seeds give different markets; the same seed repeats', () => {
    const offers = (seed: number) => new Game(createInitialState(seed)).state.market.offers;
    expect(offers(7)).toEqual(offers(7));
    const variants = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(offers(s))));
    expect(variants.size).toBeGreaterThan(1);
  });
});
