import { describe, expect, it } from 'vitest';
import { DEFAULT_SEEDS, runBalance, type DayRow } from '../scripts/balance';

// Ten seeds x ten days of the scripted player (a couple of seconds).
const results = runBalance(DEFAULT_SEEDS, 10);
const rows: DayRow[] = results.flatMap((r) => r.days);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('balance (scripted player, 10 seeds x 10 days)', () => {
  it('reaches Rank 2 on day 3-5 on every seed (ROADMAP M10)', () => {
    for (const r of results) {
      expect(r.rank2Day, `seed ${r.seed}`).not.toBeNull();
      expect(r.rank2Day ?? 0).toBeGreaterThanOrEqual(3);
      expect(r.rank2Day ?? 99).toBeLessThanOrEqual(5);
    }
  });

  it('can afford the first plant on day 1-4 (calmer start, D-042)', () => {
    for (const r of results) expect(r.plantDay ?? 99, `seed ${r.seed}`).toBeLessThanOrEqual(4);
  });

  it('makes a profit every day', () => {
    for (const d of rows) expect(d.profit).toBeGreaterThan(0);
  });

  it('keeps guests turned away for lack of a seat at a few percent, not a flood', () => {
    expect(mean(rows.map((d) => d.noSeat))).toBeLessThanOrEqual(0.15);
    expect(Math.max(...rows.map((d) => d.noSeat))).toBeLessThanOrEqual(0.3);
  });

  it('makes the biggest tip of a day clearly visible', () => {
    expect(mean(rows.map((d) => d.bigTip))).toBeGreaterThanOrEqual(6);
    expect(rows.filter((d) => d.bigTip >= 6).length / rows.length).toBeGreaterThanOrEqual(0.8);
  });
});
