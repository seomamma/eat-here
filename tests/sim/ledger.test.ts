import { describe, expect, it } from 'vitest';
import { LEDGER_NOTABLE_TIP } from '../../src/data/balance';
import { ledgerTotal, recordLedger, createDayStats } from '../../src/sim/dayStats';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { findFreeSpot } from '../../src/sim/systems/build';
import type { GameEvents } from '../../src/sim/events';

describe('money ledger', () => {
  it('sums to the day money change and matches the events (seeded day with purchases)', () => {
    const g = new Game(createInitialState(21));
    const paid: GameEvents['paid'][] = [];
    let ingredients = 0;
    g.events.on('paid', (e) => paid.push(e));
    g.events.on('ingredientsBought', (e) => (ingredients += e.amount));
    g.state.money = 1000; // enough for the purchases below, set before the day's baseline
    const start = g.state.money;
    let bought = 0;
    for (let i = 0; i < 6000 && g.state.clock.phase !== 'report'; i++) {
      g.tickOnce();
      if (i === 700) {
        const spot = findFreeSpot(g.state, 'plant_potted');
        if (!spot) throw new Error('no spot');
        expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...spot, rot: 0 }).ok).toBe(
          true,
        );
        bought++;
      }
      if (i === 900) {
        const r = g.dispatch({ type: 'buyMarketOffer', index: 0 });
        if (r.ok) bought++;
      }
    }
    expect(g.state.clock.phase).toBe('report');
    const l = g.state.dayStats.ledger;
    expect(ledgerTotal(l)).toBe(g.state.money - start);
    expect(ledgerTotal(l, 'dish')).toBe(paid.reduce((a, e) => a + e.price, 0));
    expect(ledgerTotal(l, 'tip')).toBe(paid.reduce((a, e) => a + e.tip, 0));
    expect(ledgerTotal(l, 'ingredients')).toBe(-ingredients);
    expect(ledgerTotal(l, 'furniture')).toBeLessThan(0);
    expect(l.entries.filter((e) => e.kind === 'furniture')).toHaveLength(1);
    expect(paid.length).toBeGreaterThan(3);
    expect(bought).toBeGreaterThan(0);
  });

  it('upgrades are recorded and the ledger resets with the next day', () => {
    const g = new Game(createInitialState(3));
    g.state.money = 1000;
    g.state.inventory.oregano = 5;
    const before = g.state.money;
    const r = g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' });
    const up = g.state.dayStats.ledger.entries.filter((e) => e.kind === 'upgrade');
    expect(r.ok).toBe(true);
    {
      expect(up).toHaveLength(1);
      expect(up[0]?.label).toBe('marinara:2');
      expect(ledgerTotal(g.state.dayStats.ledger)).toBe(g.state.money - before);
    }
    g.state.clock.phase = 'night';
    g.state.clock.nightTicks = 1;
    g.tickOnce();
    expect(g.state.dayStats.ledger.entries).toEqual([]);
  });

  it('stays bounded: aggregates per kind plus one notable tip', () => {
    const s = createDayStats();
    for (let i = 0; i < 5000; i++) {
      recordLedger(s, i, 'dish', 8);
      recordLedger(s, i, 'ingredients', -2);
      recordLedger(s, i, 'tip', i % 7, `Guest${i}`);
    }
    expect(s.ledger.entries.length).toBeLessThanOrEqual(4);
    const notable = s.ledger.entries.filter((e) => e.kind === 'tip' && e.label !== '');
    expect(notable).toHaveLength(1);
    expect(notable[0]?.amount).toBeGreaterThanOrEqual(LEDGER_NOTABLE_TIP);
    const tipSum = Array.from({ length: 5000 }, (_, i) => i % 7).reduce((a, b) => a + b, 0);
    expect(ledgerTotal(s.ledger, 'tip')).toBe(tipSum);
    expect(s.ledger.entries.reduce((a, e) => a + e.count, 0)).toBe(15000);
  });
});
