import { describe, expect, it } from 'vitest';
import { COIN_RISE_PX, coinRise, squash } from '../../src/view/juice';

describe('juice curves', () => {
  it('emote squash starts small, squashes, stretches and settles at 1', () => {
    expect(squash(0)).toEqual([0.5, 0.5]);
    const [sx, sy] = squash(0.4);
    expect(sx).toBeGreaterThan(1);
    expect(sy).toBeLessThan(1);
    const [tx, ty] = squash(0.7);
    expect(tx).toBeLessThan(1);
    expect(ty).toBeGreaterThan(1);
    expect(squash(1)).toEqual([1, 1]);
  });

  it('coin popup rises, overshoots a little and ends at the full rise', () => {
    expect(coinRise(0)).toBe(0);
    expect(coinRise(1)).toBe(COIN_RISE_PX);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => coinRise(i / 100)));
    expect(peak).toBeGreaterThanOrEqual(COIN_RISE_PX);
    expect(peak).toBeLessThanOrEqual(COIN_RISE_PX + 4);
  });
});
