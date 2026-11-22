import { afterEach, describe, expect, it } from 'vitest';
import { FURNITURE } from '../../src/data/furniture';
import { isGuest, isStaff, type Guest, type Staff } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import type { Furniture } from '../../src/sim/grid';
import { buildWalkGrid, isWalkable } from '../../src/sim/pathfinding';
import { serialize } from '../../src/sim/save';
import { chairFacesTable, isChairUsable, validateMove } from '../../src/sim/systems/build';
import { seatFacing } from '../../src/sim/systems/guests';
import { stationSpot } from '../../src/sim/systems/jobs';
import { createInitialState } from '../../src/sim/state';
import { DAY_TICKS, NIGHT_TICKS } from '../../src/sim/time';
import { OX, OY, openGame } from './helpers';

const rotsOf = [0, 1, 2, 3] as const;

function runUntil(g: Game, done: () => boolean, max = 8000): void {
  for (let i = 0; i < max && !done(); i++) g.tickOnce();
  expect(done()).toBe(true);
}

const guests = (g: Game): Guest[] => g.state.characters.filter(isGuest);
const staff = (g: Game): Staff[] => g.state.characters.filter(isStaff);

/** Nobody inside furniture (a guest may stand on the chair it claimed), nobody cut off from the door. */
function checkInvariants(g: Game): void {
  const walk = buildWalkGrid(g.state.grid, g.state.furniture);
  const seats = new Set<string>();
  for (const c of g.state.characters) {
    if (isGuest(c) && c.seatId) {
      expect(seats.has(c.seatId), `double claim ${c.seatId}`).toBe(false);
      seats.add(c.seatId);
    }
    for (const x of new Set([Math.floor(c.x), Math.ceil(c.x)])) {
      for (const y of new Set([Math.floor(c.y), Math.ceil(c.y)])) {
        const chair = g.state.furniture.find((f) => f.x === x && f.y === y);
        const onOwnChair = chair && isGuest(c) && c.seatId === chair.id;
        expect(isWalkable(walk, x, y) || onOwnChair, `${c.id} at ${x},${y}`).toBe(true);
      }
    }
  }
}

/** First valid new place for the piece (scan order), optionally filtered. */
function target(
  g: Game,
  piece: Furniture,
  want: (x: number, y: number, rot: 0 | 1 | 2 | 3) => boolean = () => true,
): { x: number; y: number; rot: 0 | 1 | 2 | 3 } {
  const r = g.state.room;
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      for (const rot of rotsOf) {
        if (x === piece.x && y === piece.y && rot === piece.rot) continue;
        if (validateMove(g.state, piece.id, x, y, rot).ok && want(x, y, rot)) return { x, y, rot };
      }
    }
  }
  throw new Error('no target');
}

function pieceOf(g: Game, id: string): Furniture {
  const f = g.state.furniture.find((o) => o.id === id);
  if (!f) throw new Error(`no piece ${id}`);
  return f;
}

function seatedGuest(g: Game, phase: Guest['phase']): { guest: Guest; chair: Furniture } {
  runUntil(g, () => guests(g).some((c) => c.phase === phase && c.seatId !== null));
  const guest = guests(g).find((c) => c.phase === phase && c.seatId !== null) as Guest;
  return { guest, chair: pieceOf(g, guest.seatId as string) };
}

function finishDay(g: Game): void {
  g.state.guestSpawn.enabled = false;
  for (let i = 0; i < DAY_TICKS * 3 && g.state.characters.some(isGuest); i++) {
    g.tickOnce();
    checkInvariants(g);
  }
  expect(guests(g)).toHaveLength(0);
}

describe('moving a chair a guest sits on', () => {
  it('carries the guest along: same claim and phase, facing the chair', () => {
    const g = openGame(3);
    const { guest, chair } = seatedGuest(g, 'eating');
    const to = target(g, chair, (x, y, rot) => {
      const others = g.state.furniture.filter((f) => f.id !== chair.id);
      return chairFacesTable(others, x, y, rot);
    });
    const phase = guest.phase;
    expect(g.dispatch({ type: 'moveFurniture', id: chair.id, ...to }).ok).toBe(true);
    const moved = pieceOf(g, chair.id);
    expect([guest.x, guest.y]).toEqual([to.x, to.y]);
    expect([guest.prevX, guest.prevY]).toEqual([to.x, to.y]);
    expect(guest.seatId).toBe(chair.id);
    expect(guest.phase).toBe(phase);
    expect(guest.path).toEqual([]);
    expect(guest.dir).toBe(seatFacing(moved));
    expect(isChairUsable(g.state, moved)).toBe(true);
    const paid: string[] = [];
    g.events.on('paid', (e) => paid.push(e.guestId));
    runUntil(g, () => paid.includes(guest.id));
    finishDay(g);
  });

  it('a chair that no longer faces a table is no penalty: the meal ends normally', () => {
    const g = openGame(3);
    const { guest, chair } = seatedGuest(g, 'eating');
    const to = target(g, chair, (x, y, rot) => {
      const others = g.state.furniture.filter((f) => f.id !== chair.id);
      return !chairFacesTable(others, x, y, rot);
    });
    expect(g.dispatch({ type: 'moveFurniture', id: chair.id, ...to }).ok).toBe(true);
    expect(isChairUsable(g.state, pieceOf(g, chair.id))).toBe(false);
    expect([guest.x, guest.y]).toEqual([to.x, to.y]);
    const happiness = guest.happiness;
    let paid = false;
    g.events.on('paid', (e) => {
      if (e.guestId === guest.id) paid = true;
    });
    runUntil(g, () => paid);
    expect(guest.happiness).toBeGreaterThanOrEqual(happiness);
    finishDay(g);
  });

  it('a guest still walking to the chair re-plans to the new place', () => {
    const g = openGame(4);
    runUntil(g, () => guests(g).some((c) => c.phase === 'walkingToSeat' && c.path.length > 2));
    const guest = guests(g).find((c) => c.phase === 'walkingToSeat') as Guest;
    const chair = pieceOf(g, guest.seatId as string);
    const to = target(g, chair, (x, y, rot) =>
      chairFacesTable(
        g.state.furniture.filter((f) => f.id !== chair.id),
        x,
        y,
        rot,
      ),
    );
    expect(g.dispatch({ type: 'moveFurniture', id: chair.id, ...to }).ok).toBe(true);
    expect(guest.seatId).toBe(chair.id);
    expect(guest.path.at(-1)).toEqual({ x: to.x, y: to.y });
    finishDay(g);
  });
});

describe('moving a table with guests at it', () => {
  it('seated guests stay on their chairs and finish eating', () => {
    const g = openGame(3);
    const { guest, chair } = seatedGuest(g, 'eating');
    const table = g.state.furniture.find(
      (f) =>
        FURNITURE[f.defId].kind === 'table' &&
        Math.abs(f.x - chair.x) + Math.abs(f.y - chair.y) === 1,
    ) as Furniture;
    const to = target(g, table);
    const at = [guest.x, guest.y];
    expect(g.dispatch({ type: 'moveFurniture', id: table.id, ...to }).ok).toBe(true);
    expect([guest.x, guest.y]).toEqual(at);
    expect(guest.seatId).toBe(chair.id);
    let paid = false;
    g.events.on('paid', (e) => {
      if (e.guestId === guest.id) paid = true;
    });
    runUntil(g, () => paid);
    finishDay(g);
  });
});

describe('moving stations in use', () => {
  it('the chef keeps baking and stands at the oven spot of its new place', () => {
    const g = openGame(3);
    runUntil(g, () => staff(g).some((s) => s.action === 'cook'));
    const chef = staff(g).find((s) => s.action === 'cook') as Staff;
    const oven = g.state.furniture.find((f) => f.defId === 'oven_pizza') as Furniture;
    const timer = chef.timer;
    const to = target(g, oven, (x, y) => Math.abs(x - oven.x) + Math.abs(y - oven.y) >= 2);
    expect(g.dispatch({ type: 'moveFurniture', id: oven.id, ...to }).ok).toBe(true);
    const spot = stationSpot(g.state, 'oven', 0);
    expect([chef.x, chef.y]).toEqual([spot?.tile.x, spot?.tile.y]);
    expect(chef.action).toBe('cook');
    expect(chef.timer).toBe(timer);
    expect(chef.dir).toBe(spot?.dir);
    const ready: string[] = [];
    g.events.on('dishReady', (e) => ready.push(e.orderId));
    runUntil(g, () => ready.length > 0);
    finishDay(g);
  });

  it('a pass moved while staff use it: dishes move with it, walkers re-plan', () => {
    const g = openGame(3);
    runUntil(g, () => g.state.orders.some((o) => o.slot !== null));
    const pass = g.state.furniture.find((f) => f.defId === 'counter_pass') as Furniture;
    const slots = g.state.orders.map((o) => o.slot);
    const to = target(g, pass, (x, y) => Math.abs(x - pass.x) + Math.abs(y - pass.y) >= 3);
    expect(g.dispatch({ type: 'moveFurniture', id: pass.id, ...to }).ok).toBe(true);
    expect(g.state.orders.map((o) => o.slot)).toEqual(slots);
    const served: string[] = [];
    g.events.on('dishServed', (e) => served.push(e.orderId));
    for (let i = 0; i < 4000 && served.length < 3; i++) {
      g.tickOnce();
      checkInvariants(g);
    }
    expect(served.length).toBeGreaterThanOrEqual(3);
    finishDay(g);
  });
});

describe('moving a machine in use', () => {
  const original = FURNITURE.vending_machine.interaction?.chance ?? 0;
  afterEach(() => {
    const v = FURNITURE.vending_machine.interaction;
    if (v) v.chance = original;
  });

  it('the guest using a vending machine is put on its new use spot and finishes the snack', () => {
    const v = FURNITURE.vending_machine.interaction;
    if (v) v.chance = 1;
    const g = openGame(14);
    g.state.rank = 3;
    g.state.furniture = g.state.furniture.filter((f) => FURNITURE[f.defId].kind !== 'chair');
    g.invalidateWalkGrid();
    g.state.furniture.push({
      id: 'vm',
      defId: 'vending_machine',
      x: 8 + OX,
      y: 5 + OY,
      rot: 0,
      level: 1,
    });
    runUntil(g, () => guests(g).some((c) => c.errand?.stage === 'using'), 1500);
    const user = guests(g).find((c) => c.errand?.stage === 'using') as Guest;
    const vm = pieceOf(g, 'vm');
    const to = target(g, vm, (x, y) => Math.abs(x - vm.x) + Math.abs(y - vm.y) >= 3);
    expect(g.dispatch({ type: 'moveFurniture', id: 'vm', ...to }).ok).toBe(true);
    const moved = pieceOf(g, 'vm');
    expect(Number.isInteger(user.x) && Number.isInteger(user.y)).toBe(true);
    expect(Math.abs(user.x - moved.x) + Math.abs(user.y - moved.y)).toBe(1);
    expect(user.errand?.furnitureId).toBe('vm');
    let done = false;
    g.events.on('errandDone', (e) => {
      if (e.guestId === user.id) done = true;
    });
    runUntil(g, () => done, 1000);
  });
});

describe('characters on the new footprint', () => {
  it('are nudged to the nearest reachable free tile instead of refusing the move', () => {
    const g = openGame(3);
    g.state.furniture.push({
      id: 'extra',
      defId: 'table_small',
      x: 9 + OX,
      y: 2 + OY,
      rot: 0,
      level: 1,
    });
    g.invalidateWalkGrid();
    let nudged = 0;
    for (let i = 0; i < 4000 && nudged < 3; i++) {
      g.tickOnce();
      const walker = guests(g).find(
        (c) => c.path.length > 0 && Number.isInteger(c.x) && Number.isInteger(c.y),
      );
      if (!walker) continue;
      const here = { x: walker.x, y: walker.y };
      const goal = walker.path.at(-1);
      if (!validateMove(g.state, 'extra', here.x, here.y, 0).ok) continue;
      expect(
        g.dispatch({ type: 'moveFurniture', id: 'extra', x: here.x, y: here.y, rot: 0 }).ok,
      ).toBe(true);
      nudged++;
      expect([walker.x, walker.y]).not.toEqual([here.x, here.y]);
      const walk = buildWalkGrid(g.state.grid, g.state.furniture);
      expect(isWalkable(walk, walker.x, walker.y)).toBe(true);
      expect(Math.abs(walker.x - here.x) + Math.abs(walker.y - here.y)).toBeLessThanOrEqual(3);
      if (goal && walker.path.length > 0) {
        const end = walker.path.at(-1);
        expect(end).toEqual(goal);
      }
      checkInvariants(g);
    }
    expect(nudged).toBeGreaterThan(0);
    finishDay(g);
  });

  it('a staff member working on the footprint is moved aside too', () => {
    const g = openGame(3);
    g.state.furniture.push({
      id: 'extra',
      defId: 'table_small',
      x: 9 + OX,
      y: 2 + OY,
      rot: 0,
      level: 1,
    });
    runUntil(g, () => staff(g).some((s) => s.action === 'takeOrder'));
    const waiter = staff(g).find((s) => s.action === 'takeOrder') as Staff;
    const here = { x: Math.round(waiter.x), y: Math.round(waiter.y) };
    const res = validateMove(g.state, 'extra', here.x, here.y, 0);
    if (res.ok) {
      expect(g.dispatch({ type: 'moveFurniture', id: 'extra', ...here, rot: 0 }).ok).toBe(true);
      expect([waiter.x, waiter.y]).not.toEqual([here.x, here.y]);
      expect(waiter.action).toBe('takeOrder');
      checkInvariants(g);
    }
    finishDay(g);
  });
});

describe('moving things all day', () => {
  function run(seed: number): string {
    const g = new Game(createInitialState(seed));
    g.state.money = 9999;
    g.state.rank = 3;
    let rng = seed * 7919 + 13;
    const next = (n: number) => {
      rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
      return rng % n;
    };
    let moves = 0;
    for (let day = 1; day <= 2; day++) {
      let guard = 0;
      while (g.state.clock.phase !== 'report' && guard++ < DAY_TICKS * 3) {
        g.tickOnce();
        checkInvariants(g);
        if (g.state.clock.phase === 'open' && g.state.tick % 11 === 0) {
          // Move a random piece (any kind, in use or not) to a random place and turn.
          const piece = g.state.furniture[next(g.state.furniture.length)] as Furniture;
          const r = g.state.room;
          const x = r.x0 + next(r.x1 - r.x0 + 1);
          const y = r.y0 + next(r.y1 - r.y0 + 1);
          const rot = next(4) as 0 | 1 | 2 | 3;
          if (g.dispatch({ type: 'moveFurniture', id: piece.id, x, y, rot }).ok) moves++;
        }
      }
      expect(g.state.clock.phase).toBe('report');
      expect(guests(g)).toHaveLength(0);
      expect(g.state.jobs).toHaveLength(0);
      expect(g.state.orders).toHaveLength(0);
      for (const s of staff(g)) expect(s.phase).toBe('idle');
      g.dispatch({ type: 'continueAfterReport' });
      for (let i = 0; i < NIGHT_TICKS; i++) g.tickOnce();
    }
    expect(moves).toBeGreaterThan(10);
    return serialize(g.state, 0);
  }

  it('nobody ends up stranded or inside furniture, everyone leaves, and it is deterministic', () => {
    for (const seed of [31, 32, 33]) expect(run(seed)).toBe(run(seed));
  });
});
