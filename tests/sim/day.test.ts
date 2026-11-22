import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/data/balance';
import { isGuest } from '../../src/sim/characters';
import { bestSeller, profitOf } from '../../src/sim/dayStats';
import type { DayStats } from '../../src/sim/dayStats';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { DAY_TICKS, formatClock, weekdayIndex } from '../../src/sim/time';

const MAX_DAY_TICKS = DAY_TICKS * 3;

/** Plays one full day (open -> report) and returns everything needed to compare numbers. */
function playDay(g: Game) {
  const log = {
    paid: [] as number[],
    bought: [] as number[],
    left: [] as { reason: string }[],
    arrived: 0,
    phases: [] as string[],
    ended: [] as { day: number; stats: DayStats }[],
  };
  g.events.on('paid', (e) => log.paid.push(e.amount));
  g.events.on('ingredientsBought', (e) => log.bought.push(e.amount));
  g.events.on('guestLeft', (e) => log.left.push(e));
  g.events.on('guestArrived', () => log.arrived++);
  g.events.on('phaseChanged', (e) => log.phases.push(e.phase));
  g.events.on('dayEnded', (e) => log.ended.push(e));
  const moneyBefore = g.state.money;
  expect(g.dispatch({ type: 'openRestaurant' })).toEqual({ ok: true });
  for (let i = 0; i < MAX_DAY_TICKS && g.state.clock.phase !== 'report'; i++) g.tickOnce();
  return { log, moneyBefore };
}

describe('day cycle', () => {
  it('starts in prep with the clock stopped and no guests', () => {
    const g = new Game(createInitialState(1));
    for (let i = 0; i < 600; i++) g.tickOnce();
    expect(g.state.clock).toMatchObject({ day: 1, phase: 'prep', minuteOfDay: 600, dayTick: 0 });
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
  });

  it('validates commands against the phase', () => {
    const g = new Game(createInitialState(1));
    expect(g.dispatch({ type: 'continueAfterReport' })).toMatchObject({ ok: false });
    expect(g.dispatch({ type: 'openRestaurant' })).toEqual({ ok: true });
    expect(g.dispatch({ type: 'openRestaurant' })).toMatchObject({ ok: false });
    expect(g.dispatch({ type: 'continueAfterReport' })).toMatchObject({ ok: false });
  });

  it('runs open -> closing -> report -> next prep; day takes about 4 real minutes', () => {
    const g = new Game(createInitialState(1));
    const { log } = playDay(g);
    expect(log.phases).toEqual(['open', 'closing', 'report']);
    expect(g.state.clock.dayTick).toBeGreaterThanOrEqual(DAY_TICKS);
    expect((DAY_TICKS * TICK_MS) / 1000).toBe(240);
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    expect(g.state.guestSpawn.enabled).toBe(false);
    // Time is stopped in report.
    const t = g.state.clock.minuteOfDay;
    for (let i = 0; i < 100; i++) g.tickOnce();
    expect(g.state.clock.minuteOfDay).toBe(t);
    expect(g.dispatch({ type: 'continueAfterReport' })).toEqual({ ok: true });
    expect(g.state.clock).toMatchObject({ day: 2, phase: 'prep', minuteOfDay: 600 });
    expect(g.state.dayStats).toMatchObject({ income: 0, ingredientCosts: 0, guestsServed: 0 });
  });

  it('closing: nobody new arrives, waiting guests leave as "closed" (not angry)', () => {
    const g = new Game(createInitialState(2));
    const angry: string[] = [];
    g.events.on('guestEmote', (e) => e.emote === 'angry' && angry.push(e.guestId));
    const { log } = playDay(g);
    const closed = log.left.filter((l) => l.reason === 'closed');
    expect(log.left).toHaveLength(log.arrived);
    // Every angry emote belongs to a guest that left with noSeat; closed leavers are not angry.
    expect(angry).toHaveLength(log.left.filter((l) => l.reason === 'noSeat').length);
    // With the data curve a few guests are still waiting for a seat at closing time.
    expect(closed.length).toBeGreaterThan(0);
  });

  it('report numbers equal the sums of the day events and the money delta', () => {
    for (const seed of [1, 2, 3]) {
      const g = new Game(createInitialState(seed));
      const { log, moneyBefore } = playDay(g);
      const income = log.paid.reduce((n, a) => n + a, 0);
      const costs = log.bought.reduce((n, a) => n + a, 0);
      const stats = log.ended[0]?.stats;
      expect(log.ended).toHaveLength(1);
      expect(stats).toBeDefined();
      if (!stats) return;
      expect(stats.income).toBe(income);
      expect(stats.ingredientCosts).toBe(costs);
      expect(profitOf(stats)).toBe(income - costs);
      expect(g.state.money - moneyBefore).toBe(profitOf(stats));
      expect(stats.guestsServed).toBe(log.paid.length);
      expect(stats.guestsLeftNoSeat).toBe(log.left.filter((l) => l.reason === 'noSeat').length);
      const sold = Object.values(stats.ordersByRecipe).reduce((n, c) => n + c, 0);
      expect(sold).toBe(stats.guestsServed);
      expect(stats.guestsServed).toBeGreaterThan(0);
      expect(bestSeller(stats)).not.toBeNull();
    }
  });

  it('a second day starts from clean stats and keeps the money', () => {
    const g = new Game(createInitialState(4));
    playDay(g);
    const money = g.state.money;
    g.dispatch({ type: 'continueAfterReport' });
    const { log } = playDay(g);
    expect(g.state.clock.day).toBe(2);
    expect(log.ended[0]?.stats.income).toBe(log.paid.reduce((n, a) => n + a, 0));
    expect(g.state.money).toBeGreaterThan(money - 1);
  });
});

describe('time helpers', () => {
  it('derives weekday from day (Day 1 = Monday)', () => {
    expect([1, 2, 7, 8].map(weekdayIndex)).toEqual([0, 1, 6, 0]);
  });
  it('formats HH:MM', () => {
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(1319.9)).toBe('21:59');
    expect(formatClock(5)).toBe('00:05');
  });
});

describe('pause', () => {
  it('does not advance while paused and does not catch up on resume', () => {
    const g = new Game(createInitialState(1));
    g.dispatch({ type: 'openRestaurant' });
    g.update(TICK_MS * 3);
    expect(g.state.tick).toBe(3);
    g.pause();
    expect(g.isPaused).toBe(true);
    g.update(60_000);
    g.update(TICK_MS * 50);
    expect(g.state.tick).toBe(3);
    const minute = g.state.clock.minuteOfDay;
    g.resume();
    g.update(TICK_MS * 0.5);
    expect(g.state.tick).toBe(3);
    g.update(TICK_MS);
    expect(g.state.tick).toBe(4);
    expect(g.state.clock.minuteOfDay).toBeGreaterThan(minute);
  });

  it('resume drops a partial tick accumulated before pausing', () => {
    const g = new Game(createInitialState(1));
    g.update(TICK_MS * 0.9);
    g.pause();
    g.resume();
    g.update(TICK_MS * 0.2);
    expect(g.state.tick).toBe(0);
  });
});
