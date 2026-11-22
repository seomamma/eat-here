import { describe, expect, it } from 'vitest';
import { MAX_RANK, RANKS } from '../../src/data/ranks';
import { RECIPES } from '../../src/data/recipes';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { addFame, checkRankUp } from '../../src/sim/systems/fame';
import { openGame } from './helpers';

const RANK2 = RANKS[1];
if (!RANK2) throw new Error('rank 2 missing');

describe('ranks data', () => {
  it('has the six ranks with rising thresholds, rank 2 unlocks pepperoni', () => {
    expect(RANKS.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(RANKS[0]?.name).toBe('Hole in the Wall');
    expect(RANKS[5]?.name).toBe('Legendary Pizzeria');
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]?.fame).toBeGreaterThan(RANKS[i - 1]?.fame ?? 0);
      expect(RANKS[i]?.spawnRate).toBeGreaterThan(RANKS[i - 1]?.spawnRate ?? 0);
    }
    expect(RANK2.recipes).toEqual(['pepperoni']);
    expect(RECIPES.pepperoni.unlock).toEqual({ rank: 2 });
  });
});

describe('rank up', () => {
  it('fires exactly once when the threshold is crossed and unlocks pepperoni', () => {
    const g = new Game(createInitialState(1));
    const ups: { rank: number; name: string; unlocks: string[] }[] = [];
    g.events.on('rankUp', (e) => ups.push(e));
    expect(g.state.recipes.pepperoni.unlocked).toBe(false);

    addFame(g.state, g.events, RANK2.fame - 1);
    expect(ups).toHaveLength(0);
    expect(g.state.rank).toBe(1);

    addFame(g.state, g.events, 1);
    expect(ups).toHaveLength(1);
    expect(ups[0]).toMatchObject({ rank: 2, name: RANK2.name });
    expect(ups[0]?.unlocks).toContain('Pepperoni');
    expect(g.state.rank).toBe(2);
    expect(g.state.recipes.pepperoni.unlocked).toBe(true);

    // More fame, and re-checking, never repeats it.
    addFame(g.state, g.events, 10);
    checkRankUp(g.state, g.events);
    checkRankUp(g.state, g.events);
    expect(ups).toHaveLength(1);
  });

  it('a big gain can skip ranks one by one, never past the top', () => {
    const g = new Game(createInitialState(1));
    const ups: number[] = [];
    g.events.on('rankUp', (e) => ups.push(e.rank));
    addFame(g.state, g.events, 1_000_000);
    expect(ups).toEqual([2, 3, 4, 5, 6]);
    expect(g.state.rank).toBe(MAX_RANK);
    checkRankUp(g.state, g.events);
    expect(ups).toHaveLength(5);
  });

  it('fameChanged reports the new fame and rank', () => {
    const g = new Game(createInitialState(1));
    const seen: { fame: number; gained: number; rank: number }[] = [];
    g.events.on('fameChanged', (e) => seen.push(e));
    addFame(g.state, g.events, RANK2.fame);
    addFame(g.state, g.events, 0);
    expect(seen).toEqual([{ fame: RANK2.fame, gained: RANK2.fame, rank: 2 }]);
  });

  it('guests order pepperoni after the rank up and not before (seeded run)', () => {
    const g = openGame(3);
    g.state.fame = RANK2.fame - 3;
    const orders: { recipeId: string; rank: number }[] = [];
    g.events.on('orderTaken', (e) => orders.push({ recipeId: e.recipeId, rank: g.state.rank }));
    for (let i = 0; i < 12_000; i++) g.tickOnce();
    expect(g.state.rank).toBe(2);
    const before = orders.filter((o) => o.rank === 1);
    const after = orders.filter((o) => o.rank === 2);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((o) => o.recipeId === 'pepperoni')).toBe(false);
    expect(after.some((o) => o.recipeId === 'pepperoni')).toBe(true);
  });

  it('rank 2 brings more arrivals than rank 1 (same seed)', () => {
    const count = (rank: number) => {
      const g = openGame(4);
      g.state.rank = rank;
      let n = 0;
      g.events.on('guestArrived', () => n++);
      for (let i = 0; i < 6000; i++) g.tickOnce();
      return n;
    };
    expect(count(2)).toBeGreaterThan(count(1));
  });
});

describe('pause reasons', () => {
  it('stays paused until every reason is resumed', () => {
    const g = new Game(createInitialState(1));
    g.dispatch({ type: 'openRestaurant' });
    g.pause('rankUp');
    g.pause();
    g.resume();
    expect(g.isPaused).toBe(true);
    const t = g.state.tick;
    g.update(1000);
    expect(g.state.tick).toBe(t);
    g.resume('rankUp');
    expect(g.isPaused).toBe(false);
    g.update(1000);
    expect(g.state.tick).toBeGreaterThan(t);
  });

  it('stops ticking inside an update when a tick pauses the sim', () => {
    const g = new Game(createInitialState(1));
    g.dispatch({ type: 'openRestaurant' });
    g.events.on('guestArrived', () => g.pause('rankUp'));
    for (let i = 0; i < 200 && !g.isPaused; i++) g.update(100);
    expect(g.isPaused).toBe(true);
    const t = g.state.tick;
    g.update(500);
    expect(g.state.tick).toBe(t);
  });
});
