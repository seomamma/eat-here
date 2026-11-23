import { describe, expect, it } from 'vitest';
import {
  DECOR_CAP,
  FOOD_QUICK_SEC,
  HAPPINESS_MAX,
  ORDER_QUICK_SEC,
  SEAT_QUICK_SEC,
  TIP_DIVISOR,
} from '../../src/data/happiness';
import { FURNITURE } from '../../src/data/furniture';
import { GUEST_NAMES } from '../../src/data/guests';
import { RANKS } from '../../src/data/ranks';
import { RECIPES } from '../../src/data/recipes';
import { isGuest, isStaff, type Guest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import type { Furniture } from '../../src/sim/grid';
import { createInitialState, type GameState } from '../../src/sim/state';
import {
  awardHappiness,
  decorPoints,
  fameFor,
  onOrderTaken,
  onSeated,
  onServed,
  qualityPoints,
  tipFor,
} from '../../src/sim/systems/happiness';
import { secToTicks } from '../../src/sim/systems/spawner';
import { NIGHT_TICKS } from '../../src/sim/time';
import { openGame, spawnSolo } from './helpers';

/** A freshly spawned guest on a fresh state, seated on the first chair. */
function setup(): { state: GameState; guest: Guest; chair: Furniture } {
  const state = createInitialState(1);
  state.guestSpawn.enabled = true;
  state.guestSpawn.nextInTicks = 1;
  const guest = spawnSolo(state);
  const chair = state.furniture.find((f) => FURNITURE[f.defId].kind === 'chair');
  if (!chair) throw new Error('no chair');
  guest.seatId = chair.id;
  guest.recipeId = 'marinara';
  return { state, guest, chair };
}

function plant(state: GameState, x: number, y: number, level = 1): void {
  state.furniture.push({
    id: `plant${state.furniture.length}`,
    defId: 'plant_potted',
    x,
    y,
    rot: 0,
    level,
  });
}

describe('happiness points', () => {
  it('a new guest starts with an empty bar and a name', () => {
    const { guest } = setup();
    expect(guest.happiness).toBe(0);
    expect(guest.happinessLog).toEqual([]);
    expect(GUEST_NAMES).toContain(guest.name);
  });

  it('welcome +10 is always given; seated quickly +15 within the limit, 0 just beyond it', () => {
    const fast = setup();
    fast.state.tick = fast.guest.stepTick + secToTicks(SEAT_QUICK_SEC);
    onSeated(fast.state, fast.guest);
    expect(fast.guest.happiness).toBe(25);
    expect(fast.guest.happinessLog).toEqual([
      { reason: 'welcome', points: 10 },
      { reason: 'seated', points: 15 },
    ]);

    const slow = setup();
    slow.state.tick = slow.guest.stepTick + secToTicks(SEAT_QUICK_SEC) + 1;
    onSeated(slow.state, slow.guest);
    expect(slow.guest.happiness).toBe(10);
    expect(slow.guest.happinessLog).toEqual([{ reason: 'welcome', points: 10 }]);
  });

  it('order taken quickly: +10, slow gives nothing, and the next step restarts the timer', () => {
    const fast = setup();
    fast.state.tick = 500;
    fast.guest.stepTick = 500 - secToTicks(ORDER_QUICK_SEC);
    onOrderTaken(fast.state, fast.guest);
    expect(fast.guest.happiness).toBe(10);
    expect(fast.guest.stepTick).toBe(500);

    const slow = setup();
    slow.state.tick = 500;
    slow.guest.stepTick = 500 - secToTicks(ORDER_QUICK_SEC) - 1;
    onOrderTaken(slow.state, slow.guest);
    expect(slow.guest.happiness).toBe(0);
  });

  it('food quickly: +15, plus dish quality 15 at level 1 (no decor)', () => {
    const { state, guest } = setup();
    state.tick = 1000;
    guest.stepTick = 1000 - secToTicks(FOOD_QUICK_SEC);
    onServed(state, guest);
    expect(guest.happinessLog).toEqual([
      { reason: 'food', points: 15 },
      { reason: 'quality', points: 15 },
    ]);
    expect(guest.happiness).toBe(30);
  });

  it('slow food gives only the quality points', () => {
    const { state, guest } = setup();
    state.tick = 1000;
    guest.stepTick = 1000 - secToTicks(FOOD_QUICK_SEC) - 1;
    onServed(state, guest);
    expect(guest.happinessLog).toEqual([{ reason: 'quality', points: 15 }]);
  });

  it('dish quality follows the recipe level: 10 + 5 x level', () => {
    expect([1, 2, 3, 5].map(qualityPoints)).toEqual([15, 20, 25, 35]);
    const { state, guest } = setup();
    state.recipes.marinara.level = 3;
    state.tick = guest.stepTick + secToTicks(FOOD_QUICK_SEC) + 100;
    onServed(state, guest);
    expect(guest.happinessLog).toEqual([{ reason: 'quality', points: 25 }]);
  });

  it('a perfect Lv.1 visit without decor adds up to 65', () => {
    const { state, guest } = setup();
    onSeated(state, guest);
    onOrderTaken(state, guest);
    onServed(state, guest);
    expect(guest.happiness).toBe(10 + 15 + 10 + 15 + 15);
  });

  it('never exceeds the maximum', () => {
    const { guest } = setup();
    awardHappiness(guest, 'quality', 90);
    awardHappiness(guest, 'decor', 30);
    expect(guest.happiness).toBe(HAPPINESS_MAX);
    expect(guest.happinessLog.reduce((n, e) => n + e.points, 0)).toBe(HAPPINESS_MAX);
  });
});

describe('decor appeal', () => {
  it('counts decor within the Chebyshev radius of the chair only', () => {
    const { state, chair } = setup();
    expect(decorPoints(state.furniture, chair)).toBe(0);
    const appeal = FURNITURE.plant_potted.appeal[0] ?? 0;
    plant(state, chair.x, chair.y + 2); // distance 2: counted
    expect(decorPoints(state.furniture, chair)).toBe(appeal);
    plant(state, chair.x - 2, chair.y - 2); // diagonal distance 2: counted
    expect(decorPoints(state.furniture, chair)).toBe(appeal * 2);
    plant(state, chair.x + 3, chair.y); // distance 3: too far
    expect(decorPoints(state.furniture, chair)).toBe(appeal * 2);
  });

  it('uses the appeal of the furniture level and ignores non-decor furniture', () => {
    const { state, chair } = setup();
    // The start layout has tables/chairs next to the chair; they add nothing.
    expect(decorPoints(state.furniture, chair)).toBe(0);
    plant(state, chair.x, chair.y + 1, 3);
    expect(decorPoints(state.furniture, chair)).toBe(FURNITURE.plant_potted.appeal[2]);
  });

  it('is capped', () => {
    const { state, chair } = setup();
    for (let i = 0; i < 4; i++) plant(state, chair.x + (i % 2), chair.y + 1 + Math.floor(i / 2), 5);
    expect(decorPoints(state.furniture, chair)).toBe(DECOR_CAP);
  });

  it('is awarded once the dish is served and shows up in the log', () => {
    const { state, guest, chair } = setup();
    plant(state, chair.x, chair.y + 1);
    state.tick = guest.stepTick + secToTicks(FOOD_QUICK_SEC) + 100;
    onServed(state, guest);
    expect(guest.happinessLog).toContainEqual({
      reason: 'decor',
      points: FURNITURE.plant_potted.appeal[0],
    });
  });
});

describe('fame and tip formulas', () => {
  it('fame = floor(happiness / 10)', () => {
    expect([0, 9, 10, 35, 99, 100].map(fameFor)).toEqual([0, 0, 1, 3, 9, 10]);
  });

  it('tip = round(price x happiness / TIP_DIVISOR), clearly visible for happy guests', () => {
    expect(TIP_DIVISOR).toBe(140);
    expect(tipFor(10, 0)).toBe(0);
    expect(tipFor(10, 35)).toBe(3);
    expect(tipFor(13, 100)).toBe(9);
    expect(tipFor(8, 100)).toBe(6);
    // A very happy (90) Pepperoni guest tips 5-8 (M10 balance goal).
    expect(tipFor(13, 90)).toBeGreaterThanOrEqual(5);
    expect(tipFor(13, 90)).toBeLessThanOrEqual(8);
  });
});

describe('visit integration', () => {
  /** Runs a restaurant until the first guest paid; records the events of that guest. */
  function firstVisit(seed: number) {
    const g = openGame(seed);
    const ev = {
      emotes: [] as string[],
      paid: null as null | { price: number; tip: number; amount: number; fame: number },
      fame: [] as number[],
      moneyBefore: g.state.money,
      guestId: '',
      happinessAtPay: 0,
      recipe: '',
    };
    g.events.on('guestEmote', (e) => {
      if (!ev.guestId) ev.guestId = e.guestId;
      if (e.guestId === ev.guestId) ev.emotes.push(e.emote);
    });
    g.events.on('paid', (e) => {
      if (ev.paid) return;
      ev.paid = { price: e.price, tip: e.tip, amount: e.amount, fame: e.fame };
      const c = g.state.characters.find((x) => x.id === e.guestId);
      if (c && isGuest(c)) {
        ev.happinessAtPay = c.happiness;
        ev.recipe = c.recipeId ?? '';
      }
    });
    g.events.on('fameChanged', (e) => ev.fame.push(e.fame));
    for (let i = 0; i < 3000 && !ev.paid; i++) g.tickOnce();
    return { g, ev };
  }

  it('pays price + tip, adds fame, and the first guest is quick everywhere', () => {
    const { g, ev } = firstVisit(1);
    expect(ev.paid).not.toBeNull();
    const p = ev.paid;
    if (!p) return;
    expect(p.amount).toBe(p.price + p.tip);
    expect(p.tip).toBe(tipFor(p.price, ev.happinessAtPay));
    expect(p.fame).toBe(fameFor(ev.happinessAtPay));
    expect(ev.happinessAtPay).toBeGreaterThanOrEqual(30); // seated, order, food, quality all quick
    expect(g.state.fame).toBe(p.fame);
    expect(ev.fame.at(-1)).toBe(p.fame);
    expect(g.state.money).toBeGreaterThan(ev.moneyBefore);
    expect(g.state.dayStats.tips).toBe(p.tip);
    expect(g.state.dayStats.fameGained).toBe(p.fame);
    expect(ev.emotes).toContain('tasty');
  });

  it('shows the love emote when the guest is very happy at the end', () => {
    const g = openGame(1);
    const emotes: string[] = [];
    g.events.on('guestEmote', (e) => emotes.push(e.emote));
    g.events.on('dishServed', (e) => {
      const c = g.state.characters.find((x) => x.id === e.guestId);
      if (c && isGuest(c)) c.happiness = 85;
    });
    for (let i = 0; i < 1500 && !emotes.includes('love'); i++) g.tickOnce();
    expect(emotes).toContain('love');
    expect(emotes.indexOf('love')).toBeGreaterThan(emotes.indexOf('tasty'));
  });

  it('shows the slow emote (once) when the food takes too long, and gives no food points', () => {
    const g = openGame(1);
    // No chef: orders are taken but never cooked.
    g.state.characters = g.state.characters.filter((c) => !(isStaff(c) && c.role === 'chef'));
    const slow: string[] = [];
    g.events.on('guestEmote', (e) => {
      if (e.emote === 'slow') slow.push(e.guestId);
    });
    for (let i = 0; i < 1200; i++) g.tickOnce();
    expect(slow.length).toBeGreaterThan(0);
    expect(new Set(slow).size).toBe(slow.length);
    const waiting = g.state.characters.filter(isGuest).find((c) => c.phase === 'waitingForFood');
    expect(waiting?.happinessLog.some((e) => e.reason === 'food')).toBe(false);
  });

  it('guests without a seat give no fame', () => {
    const g = openGame(11);
    const chairs = g.state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
    g.state.furniture = g.state.furniture.filter((f) => !chairs.slice(1).includes(f));
    g.invalidateWalkGrid();
    let fame = 0;
    let noSeat = 0;
    g.events.on('paid', (e) => (fame += e.fame));
    g.events.on('guestLeft', (e) => {
      if (e.reason === 'noSeat') noSeat++;
    });
    for (let i = 0; i < 6000; i++) g.tickOnce();
    expect(noSeat).toBeGreaterThan(0);
    expect(g.state.fame).toBe(fame);
  });

  it('is deterministic including fame and rank', () => {
    const run = () => {
      const g = openGame(9);
      g.state.fame = (RANKS[1]?.fame ?? 0) - 10;
      for (let i = 0; i < 4000; i++) g.tickOnce();
      return JSON.stringify(g.state);
    };
    expect(run()).toBe(run());
    expect(JSON.parse(run()).rank).toBe(2);
  });

  it('keeps the recipe table consistent with the unlock data', () => {
    expect(RECIPES.pepperoni.unlock).toEqual({ rank: 2 });
  });
});

describe('day stats', () => {
  it('report numbers add up: income includes tips, fame gained matches the events', () => {
    const g = new Game(createInitialState(2));
    const paid: { amount: number; tip: number; fame: number }[] = [];
    g.events.on('paid', (e) => paid.push(e));
    for (let i = 0; i < 10_000 && g.state.clock.phase !== 'report'; i++) g.tickOnce();
    const s = g.state.dayStats;
    expect(paid.length).toBeGreaterThan(10);
    expect(s.income).toBe(paid.reduce((n, p) => n + p.amount, 0));
    expect(s.tips).toBe(paid.reduce((n, p) => n + p.tip, 0));
    expect(s.fameGained).toBe(paid.reduce((n, p) => n + p.fame, 0));
    expect(s.tips).toBeGreaterThan(0);
    expect(s.fameGained).toBeGreaterThan(0);
    g.dispatch({ type: 'continueAfterReport' });
    for (let i = 0; i < NIGHT_TICKS; i++) g.tickOnce();
    expect(g.state.dayStats).toMatchObject({ tips: 0, fameGained: 0 });
  });
});
