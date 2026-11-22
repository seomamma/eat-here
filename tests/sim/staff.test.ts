import { describe, expect, it } from 'vitest';
import { PASS_SLOTS, TICK_MS } from '../../src/data/balance';
import { RECIPES } from '../../src/data/recipes';
import { isGuest, isStaff, type Staff } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { buildWalkGrid, isWalkable } from '../../src/sim/pathfinding';
import { OX, OY, openGame } from './helpers';

const TICKS_PER_SEC = 1000 / TICK_MS;

interface Log {
  arrived: string[];
  left: string[];
  paid: number[];
  taken: string[];
  bought: number[];
  ready: string[];
  served: string[];
  discarded: string[];
}

function attach(g: Game): Log {
  const log: Log = {
    arrived: [],
    left: [],
    paid: [],
    taken: [],
    bought: [],
    ready: [],
    served: [],
    discarded: [],
  };
  g.events.on('guestArrived', (e) => log.arrived.push(e.guestId));
  g.events.on('guestLeft', (e) => log.left.push(e.guestId));
  g.events.on('paid', (e) => log.paid.push(e.amount));
  g.events.on('orderTaken', (e) => log.taken.push(e.orderId));
  g.events.on('ingredientsBought', (e) => log.bought.push(e.amount));
  g.events.on('dishReady', (e) => log.ready.push(e.orderId));
  g.events.on('dishServed', (e) => log.served.push(e.orderId));
  g.events.on('orderDiscarded', (e) => log.discarded.push(e.orderId));
  return log;
}

function staffOf(g: Game): Staff[] {
  return g.state.characters.filter(isStaff);
}

function checkInvariants(g: Game): void {
  const { state } = g;
  const walk = buildWalkGrid(state.grid, state.furniture);
  // A job is claimed by at most one staff, and the claim is mutual.
  const claimed = new Set<string>();
  for (const s of staffOf(g)) {
    if (s.jobId) {
      expect(claimed.has(s.jobId)).toBe(false);
      claimed.add(s.jobId);
      const job = state.jobs.find((j) => j.id === s.jobId);
      expect(job?.assigneeId).toBe(s.id);
    }
    for (const [tx, ty] of [
      [Math.floor(s.x), Math.floor(s.y)],
      [Math.ceil(s.x), Math.ceil(s.y)],
    ] as const) {
      if (!isWalkable(walk, tx, ty)) {
        throw new Error(`${s.id} (${s.role}) on blocked tile ${tx},${ty} at tick ${state.tick}`);
      }
    }
  }
  for (const j of state.jobs) {
    if (j.assigneeId) expect(claimed.has(j.id)).toBe(true);
  }
  expect(state.orders.filter((o) => o.slot !== null).length).toBeLessThanOrEqual(PASS_SLOTS);
}

function run(g: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    g.tickOnce();
    checkInvariants(g);
  }
}

function runUntil(g: Game, cond: () => boolean, maxTicks = 20_000): void {
  for (let i = 0; i < maxTicks && !cond(); i++) {
    g.tickOnce();
    checkInvariants(g);
  }
  expect(cond()).toBe(true);
}

function simulate(seed: number, hours: number) {
  const g = openGame(seed);
  const log = attach(g);
  run(g, hours * 3600 * TICKS_PER_SEC);
  g.state.guestSpawn.enabled = false;
  run(g, 600 * TICKS_PER_SEC);
  return { g, log };
}

describe('staff, jobs and orders', () => {
  it('starts with one chef and one waiter at their idle spots', () => {
    const g = openGame();
    expect(
      staffOf(g)
        .map((s) => s.role)
        .sort(),
    ).toEqual(['chef', 'waiter']);
    for (const s of staffOf(g))
      expect(s).toMatchObject({ x: s.home.x, y: s.home.y, phase: 'idle' });
  });

  it('runs the full flow: take order, cook, serve, eat, pay', () => {
    const g = openGame(2);
    const log = attach(g);
    runUntil(g, () => log.paid.length >= 1);
    expect(log.taken.length).toBeGreaterThanOrEqual(1);
    expect(log.bought.length).toBeGreaterThanOrEqual(1);
    expect(log.ready.length).toBeGreaterThanOrEqual(1);
    expect(log.served.length).toBeGreaterThanOrEqual(1);
  });

  it('never lets two staff claim the same job (checked every tick, 2 staff + extra waiter)', () => {
    const g = openGame(9);
    const waiter = staffOf(g).find((s) => s.role === 'waiter') as Staff;
    g.state.characters.push({
      ...waiter,
      id: 'staff3',
      home: { x: 7 + OX, y: 4 + OY },
      x: 7 + OX,
      y: 4 + OY,
      prevX: 7 + OX,
      prevY: 4 + OY,
    });
    run(g, 600 * TICKS_PER_SEC);
    expect(g.state.tick).toBeGreaterThan(0);
  });

  it('deducts the ingredient cost when cooking starts', () => {
    const g = openGame(2);
    const money: number[] = [];
    g.events.on('ingredientsBought', (e) => money.push(g.state.money + e.amount));
    const before = g.state.money;
    runUntil(g, () => money.length > 0);
    expect(money[0]).toBe(before);
  });

  const scenarios: [string, (g: Game) => boolean][] = [
    [
      'waiter walking to take the order',
      (g) => g.state.jobs.some((j) => j.kind === 'takeOrder' && j.assigneeId),
    ],
    ['chef cooking', (g) => g.state.orders.some((o) => o.status === 'cooking')],
    ['dish ready on the pass', (g) => g.state.orders.some((o) => o.status === 'ready')],
    ['waiter carrying the dish', (g) => g.state.orders.some((o) => o.status === 'delivering')],
  ];
  for (const [name, cond] of scenarios) {
    it(`cancels the jobs when the guest leaves mid-flow: ${name}`, () => {
      const g = openGame(2);
      const log = attach(g);
      runUntil(g, () => cond(g));
      const order = g.state.orders.find(
        (o) => o.status !== 'served',
      ) as (typeof g.state.orders)[number];
      const guest = g.state.characters.find((c) => c.id === order.guestId);
      expect(guest && isGuest(guest)).toBe(true);
      if (guest && isGuest(guest)) guest.phase = 'gone';
      run(g, 2);
      expect(g.state.orders.find((o) => o.id === order.id)).toBeUndefined();
      expect(g.state.jobs.filter((j) => j.orderId === order.id)).toHaveLength(0);
      expect(log.discarded).toContain(order.id);
      for (const s of staffOf(g)) {
        if (s.jobId) expect(g.state.jobs.some((j) => j.id === s.jobId)).toBe(true);
      }
      // Nothing else is affected: the game keeps going and drains.
      g.state.guestSpawn.enabled = false;
      run(g, 300 * TICKS_PER_SEC);
      for (const s of staffOf(g)) {
        expect(s.phase).toBe('idle');
        expect(s.carrying).toBeNull();
      }
      expect(g.state.jobs).toHaveLength(0);
      expect(g.state.orders).toHaveLength(0);
    });
  }

  it('the chef waits at a full pass until the waiter frees a slot', () => {
    const g = openGame(2);
    const log = attach(g);
    // Let several orders get taken, then remove the waiter: dishes pile up on the pass.
    runUntil(g, () => log.taken.length - log.served.length >= PASS_SLOTS + 1, 6000);
    g.state.characters = g.state.characters.filter((c) => !(isStaff(c) && c.role === 'waiter'));
    run(g, 240 * TICKS_PER_SEC);
    const ready = g.state.orders.filter((o) => o.status === 'ready');
    expect(ready).toHaveLength(PASS_SLOTS);
    const chef = staffOf(g)[0] as Staff;
    expect(chef.carrying).not.toBeNull();
  });

  it('simulates 2 hours: orders taken = cooked = served, everyone leaves, staff idle, money adds up', () => {
    const { g, log } = simulate(7, 2);
    expect(log.arrived.length).toBeGreaterThan(200);
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    expect([...log.left].sort()).toEqual([...log.arrived].sort());
    expect(log.discarded).toHaveLength(0);
    expect(log.taken.length).toBeGreaterThan(100);
    expect(log.ready).toHaveLength(log.taken.length);
    expect(log.bought).toHaveLength(log.taken.length);
    expect(log.served).toHaveLength(log.taken.length);
    expect(g.state.jobs).toHaveLength(0);
    expect(g.state.orders).toHaveLength(0);
    for (const s of staffOf(g)) {
      expect(s.phase).toBe('idle');
      expect(s.carrying).toBeNull();
      expect(s.path).toHaveLength(0);
      expect({ x: s.x, y: s.y }).toEqual(s.home);
    }
    const paid = log.paid.reduce((n, p) => n + p, 0);
    const costs = log.bought.reduce((n, c) => n + c, 0);
    expect(g.state.money).toBe(300 + paid - costs);
    expect(log.paid.every((p) => p > 0)).toBe(true);
    // Only unlocked recipes are cooked (pepperoni once rank 2 is reached).
    const allowed: { ingredientCost: number }[] = [
      RECIPES.marinara,
      RECIPES.margherita,
      RECIPES.garlic_bread,
    ];
    if (g.state.rank >= 2) allowed.push(RECIPES.pepperoni);
    for (const b of log.bought) expect(allowed.map((r) => r.ingredientCost)).toContain(b);
  });

  it('is deterministic for a fixed seed', () => {
    const a = simulate(3, 0.5);
    const b = simulate(3, 0.5);
    expect(JSON.stringify(a.g.state)).toBe(JSON.stringify(b.g.state));
    expect(a.log).toEqual(b.log);
  });
});
