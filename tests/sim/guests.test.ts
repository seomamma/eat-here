import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../../src/data/balance';
import { FURNITURE } from '../../src/data/furniture';
import { RECIPES } from '../../src/data/recipes';
import { isGuest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { buildWalkGrid, findPath, isWalkable } from '../../src/sim/pathfinding';
import { createInitialState } from '../../src/sim/state';
import { openGame } from './helpers';

const TICKS_PER_HOUR = (3600 * 1000) / TICK_MS;

interface Log {
  arrived: string[];
  left: { guestId: string; reason: string }[];
  paid: { guestId: string; price: number; amount: number }[];
  seated: string[];
  emotes: { guestId: string; emote: string }[];
  moneyEvents: number[];
  costs: number[];
}

function attach(g: Game): Log {
  const log: Log = {
    arrived: [],
    left: [],
    paid: [],
    seated: [],
    emotes: [],
    moneyEvents: [],
    costs: [],
  };
  g.events.on('guestArrived', (e) => log.arrived.push(e.guestId));
  g.events.on('guestLeft', (e) => log.left.push(e));
  g.events.on('paid', (e) => log.paid.push(e));
  g.events.on('guestSeated', (e) => log.seated.push(e.guestId));
  g.events.on('guestEmote', (e) => log.emotes.push(e));
  g.events.on('moneyChanged', (e) => log.moneyEvents.push(e.money));
  g.events.on('ingredientsBought', (e) => log.costs.push(e.amount));
  return log;
}

/** Invariants that must hold on every tick. */
function checkInvariants(g: Game): void {
  const walk = buildWalkGrid(g.state.grid, g.state.furniture);
  const claims = new Set<string>();
  for (const c of g.state.characters) {
    if (!isGuest(c)) continue;
    if (c.seatId) {
      expect(claims.has(c.seatId)).toBe(false);
      claims.add(c.seatId);
    }
    const chair = c.seatId ? g.state.furniture.find((f) => f.id === c.seatId) : undefined;
    for (const [tx, ty] of [
      [Math.floor(c.x), Math.floor(c.y)],
      [Math.ceil(c.x), Math.ceil(c.y)],
    ] as const) {
      const onOwnChair = chair !== undefined && chair.x === tx && chair.y === ty;
      if (!onOwnChair && !isWalkable(walk, tx, ty)) {
        throw new Error(
          `${c.id} (${c.phase}) stands on blocked tile ${tx},${ty} at tick ${g.state.tick}`,
        );
      }
    }
  }
}

function run(g: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    g.tickOnce();
    checkInvariants(g);
  }
}

function runHour(seed: number) {
  const g = openGame(seed);
  const log = attach(g);
  run(g, TICKS_PER_HOUR);
  g.state.guestSpawn.enabled = false;
  run(g, (300 * 1000) / TICK_MS);
  return { g, log };
}

describe('guest system', () => {
  it('simulates one hour: everyone ends up gone, no double booking, money matches', () => {
    const { g, log } = runHour(7);
    expect(log.arrived.length).toBeGreaterThan(100);
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    expect(log.left.map((l) => l.guestId).sort()).toEqual([...log.arrived].sort());
    const total = log.paid.reduce((n, p) => n + p.amount, 0);
    const costs = log.costs.reduce((n, c) => n + c, 0);
    expect(g.state.money).toBe(300 + total - costs);
    expect(log.moneyEvents.at(-1)).toBe(g.state.money);
    expect(log.paid.length).toBe(log.left.filter((l) => l.reason === 'done').length);
    expect(log.seated.length).toBe(log.paid.length);
    for (const p of log.paid) expect(p.amount).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runHour(3);
    const b = runHour(3);
    expect(JSON.stringify(a.g.state)).toBe(JSON.stringify(b.g.state));
    expect(a.log).toEqual(b.log);
    const c = runHour(4);
    expect(
      c.log.arrived.length === a.log.arrived.length && c.g.state.money === a.g.state.money,
    ).toBe(false);
  });

  it('full house: guests beyond the chairs wait, get angry and leave with noSeat', () => {
    const g = openGame(11);
    // Keep a single chair, so every other guest has to wait.
    const chairs = g.state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
    g.state.furniture = g.state.furniture.filter((f) => !chairs.slice(1).includes(f));
    g.invalidateWalkGrid();
    const log = attach(g);
    run(g, (600 * 1000) / TICK_MS);
    g.state.guestSpawn.enabled = false;
    run(g, (300 * 1000) / TICK_MS);
    const noSeat = log.left.filter((l) => l.reason === 'noSeat');
    expect(noSeat.length).toBeGreaterThan(0);
    expect(log.emotes.filter((e) => e.emote === 'angry')).toHaveLength(noSeat.length);
    expect(log.left).toHaveLength(log.arrived.length);
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
  });

  it('only unlocked recipes are eaten (pepperoni only after the rank up)', () => {
    const g = openGame(5);
    expect(g.state.recipes.pepperoni.unlocked).toBe(false);
    const log = attach(g);
    // Rank-ups are covered in fame.test.ts; here the fame stays below rank 2.
    g.events.on('fameChanged', () => {
      g.state.fame = Math.min(g.state.fame, 10);
    });
    run(g, 20_000);
    expect(g.state.rank).toBe(1);
    const prices = new Set(Object.values(RECIPES).map((r) => r.price));
    expect(log.paid.length).toBeGreaterThan(0);
    for (const p of log.paid) {
      expect(prices.has(p.price)).toBe(true);
      expect(p.price).not.toBe(RECIPES.pepperoni.price);
    }
  });

  it('a seated guest faces the table', () => {
    const g = openGame(1);
    const seen: string[] = [];
    g.events.on('guestSeated', (e) => {
      const guest = g.state.characters.find((c) => c.id === e.guestId);
      if (guest) seen.push(`${e.seatId}:${guest.dir}`);
    });
    run(g, 400);
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(['f4:dr', 'f5:ul', 'f7:dr', 'f8:ul']).toContain(s);
  });
});

describe('findPath with blocked goal', () => {
  it('reaches a chair only when allowed, and never walks through other furniture', () => {
    const s = createInitialState();
    const walk = buildWalkGrid(s.grid, s.furniture);
    const chair = { x: 2, y: 6 };
    expect(findPath(walk, { x: 4, y: 10 }, chair)).toBeNull();
    const path = findPath(walk, { x: 4, y: 10 }, chair, { allowGoalBlocked: true });
    expect(path?.at(-1)).toEqual(chair);
    for (const t of path?.slice(0, -1) ?? []) expect(isWalkable(walk, t.x, t.y)).toBe(true);
  });

  it('can start from a blocked tile when allowed', () => {
    const s = createInitialState();
    const walk = buildWalkGrid(s.grid, s.furniture);
    expect(findPath(walk, { x: 2, y: 6 }, { x: 4, y: 11 })).toBeNull();
    const path = findPath(walk, { x: 2, y: 6 }, { x: 4, y: 11 }, { allowStartBlocked: true });
    expect(path?.[0]).toEqual({ x: 2, y: 6 });
    for (const t of path?.slice(1) ?? []) expect(isWalkable(walk, t.x, t.y)).toBe(true);
  });
});
