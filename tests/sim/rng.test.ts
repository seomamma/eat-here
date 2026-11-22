import { describe, expect, it } from 'vitest';
import { rngInt, rngNext, rngPick } from '../../src/sim/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const seqA = Array.from({ length: 20 }, () => rngNext(a));
    const seqB = Array.from({ length: 20 }, () => rngNext(b));
    expect(seqA).toEqual(seqB);
    expect(a.rng).toBe(b.rng);
  });

  it('differs between seeds and stays in [0, 1)', () => {
    const a = { rng: 1 };
    const b = { rng: 2 };
    expect(rngNext(a)).not.toBe(rngNext(b));
    for (let i = 0; i < 1000; i++) {
      const v = rngNext(a);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('resumes from stored state', () => {
    const a = { rng: 7 };
    rngNext(a);
    const saved = { rng: a.rng };
    expect(rngNext(a)).toBe(rngNext(saved));
  });

  it('rngInt covers the inclusive range and rngPick picks members', () => {
    const s = { rng: 3 };
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(rngInt(s, 1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
    expect(['a', 'b']).toContain(rngPick(s, ['a', 'b']));
  });
});
