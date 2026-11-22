import { describe, expect, it } from 'vitest';
import { burstBudget, gapPassed } from '../../src/platform/audioRate';

describe('audio rate limiter', () => {
  it('lets a sound play the first time and after its gap', () => {
    expect(gapPassed(undefined, 1000, 140)).toBe(true);
    expect(gapPassed(1000, 1100, 140)).toBe(false);
    expect(gapPassed(1000, 1140, 140)).toBe(true);
  });

  it('caps how many sounds start inside the window', () => {
    let recent: number[] = [];
    const started: number[] = [];
    for (let t = 0; t < 600; t += 50) {
      const b = burstBudget(recent, t, 600, 5);
      recent = b.recent;
      if (b.ok) {
        recent.push(t);
        started.push(t);
      }
    }
    expect(started).toHaveLength(5);
  });

  it('forgets old sounds once the window has passed', () => {
    const b = burstBudget([0, 10, 20, 30, 40], 700, 600, 5);
    expect(b.ok).toBe(true);
    expect(b.recent).toEqual([]);
  });
});
