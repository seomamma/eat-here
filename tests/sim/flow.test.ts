import { describe, expect, it } from 'vitest';
import { isGuest, isStaff } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { buildWalkGrid, isWalkable } from '../../src/sim/pathfinding';
import { createInitialState } from '../../src/sim/state';
import { isInUse, validateMove, validatePlacement } from '../../src/sim/systems/build';
import { DAY_TICKS, NIGHT_TICKS } from '../../src/sim/time';
import { OX, OY, openGame } from './helpers';

function runUntil(g: Game, done: () => boolean, max = 6000): void {
  for (let i = 0; i < max && !done(); i++) g.tickOnce();
  expect(done()).toBe(true);
}

describe('furniture in use', () => {
  it('a chair claimed by a guest and the oven or pass at work cannot be sold, but can be moved', () => {
    const g = openGame(3);
    runUntil(g, () => g.state.characters.some((c) => isGuest(c) && c.seatId !== null));
    const guest = g.state.characters.find((c) => isGuest(c) && c.seatId);
    if (!guest || !isGuest(guest)) throw new Error('no seated guest');
    const chair = g.state.furniture.find((f) => f.id === guest.seatId);
    if (!chair) throw new Error('no chair');
    expect(isInUse(g.state, chair)).toBe(true);
    expect(g.dispatch({ type: 'sellFurniture', id: chair.id })).toEqual({
      ok: false,
      reason: 'inUse',
    });
    // Rotating in place is a move, and moves are allowed while in use (see relocate.test.ts).
    expect(validateMove(g.state, chair.id, chair.x, chair.y, 0).ok).toBe(true);
    const oven = g.state.furniture.find((f) => f.defId === 'oven_pizza');
    if (!oven) throw new Error('missing oven');
    expect(isInUse(g.state, oven)).toBe(false);
    runUntil(g, () => g.state.characters.some((c) => isStaff(c) && c.action === 'cook'));
    expect(isInUse(g.state, oven)).toBe(true);
    expect(validateMove(g.state, oven.id, oven.x, oven.y, 0).ok).toBe(true);
  });
});

describe('characters on tiles', () => {
  it('refuses a placement on the tile of a character or the one it walks into', () => {
    const g = openGame(3);
    runUntil(g, () => g.state.characters.some((c) => isGuest(c) && c.path.length > 0));
    const guest = g.state.characters.find((c) => isGuest(c) && c.path.length > 0);
    if (!guest) throw new Error('no guest');
    const here = { x: Math.round(guest.x), y: Math.round(guest.y) };
    const next = guest.path[0] ?? here;
    for (const t of [here, next]) {
      const r = validatePlacement(g.state, 'plant_potted', t.x, t.y, 0);
      expect(r.ok ? 'ok' : r.reason).not.toBe('ok');
      expect(r).not.toEqual({ ok: true });
    }
    // Staff standing at their idle tile also block it.
    const chef = g.state.characters.find((c) => isStaff(c) && c.role === 'chef');
    if (!chef) throw new Error('no chef');
    chef.path = [];
    chef.x = chef.prevX = 4 + OX;
    chef.y = chef.prevY = 2 + OY;
    expect(validatePlacement(g.state, 'plant_potted', 4 + OX, 2 + OY, 0)).toEqual({
      ok: false,
      reason: 'characterHere',
    });
  });
});

/** Every character stands on a walkable tile (guests may sit on their own chair). */
function checkNobodyStuck(g: Game): void {
  const walk = buildWalkGrid(g.state.grid, g.state.furniture);
  for (const c of g.state.characters) {
    const chair = isGuest(c) && c.seatId ? g.state.furniture.find((f) => f.id === c.seatId) : null;
    for (const [tx, ty] of [
      [Math.floor(c.x), Math.floor(c.y)],
      [Math.ceil(c.x), Math.ceil(c.y)],
    ] as const) {
      const onOwnChair = chair && chair.x === tx && chair.y === ty;
      if (!onOwnChair && !isWalkable(walk, tx, ty)) {
        throw new Error(`${c.id} stands on blocked tile ${tx},${ty} at tick ${g.state.tick}`);
      }
    }
  }
}

describe('building while the restaurant runs', () => {
  it('3 days with mid-day purchases and table moves: nobody stuck, everyone leaves by the report', () => {
    const g = new Game(createInitialState(11));
    g.state.money = 5000;
    // The start tables are rarely free at runtime; an extra table without chairs always is.
    g.state.furniture.push({
      id: 'extra',
      defId: 'table_small',
      x: 7 + OX,
      y: 6 + OY,
      rot: 0,
      level: 1,
    });
    let moves = 0;
    let buys = 0;
    for (let day = 1; day <= 3; day++) {
      expect(g.state.clock).toMatchObject({ day, phase: 'open' });
      let guard = 0;
      while (g.state.clock.phase !== 'report' && guard++ < DAY_TICKS * 3) {
        g.tickOnce();
        checkNobodyStuck(g);
        const t = g.state.clock.dayTick;
        if (g.state.clock.phase === 'open' && t > 300 && t % 23 === 0) {
          // Shuffle a table between two places and drop a plant somewhere free.
          const tables = g.state.furniture.filter((f) => f.defId === 'table_small');
          for (const table of tables) {
            const to = table.y <= 7 + OY ? table.y + 3 : table.y - 3;
            if (g.dispatch({ type: 'moveFurniture', id: table.id, x: table.x, y: to, rot: 0 }).ok) {
              moves++;
            }
          }
          if (t % 69 === 0) {
            const x = 1 + OX + ((t / 69) % 8);
            if (
              g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x, y: 7 + OY, rot: 0 }).ok
            ) {
              buys++;
            }
          }
        }
      }
      expect(g.state.clock.phase).toBe('report');
      expect(g.state.characters.filter(isGuest)).toHaveLength(0);
      expect(g.state.jobs).toHaveLength(0);
      expect(g.state.orders).toHaveLength(0);
      expect(g.state.dayStats.guestsServed).toBeGreaterThan(0);
      g.dispatch({ type: 'continueAfterReport' });
      for (let i = 0; i < NIGHT_TICKS; i++) g.tickOnce();
    }
    expect(g.state.clock).toMatchObject({ day: 4, phase: 'open' });
    expect(moves).toBeGreaterThan(0);
    expect(buys).toBeGreaterThan(0);
  });

  it('re-plans walkers whose route is blocked by a new piece', () => {
    const g = openGame(4);
    runUntil(g, () =>
      g.state.characters.some(
        (c) => isGuest(c) && c.path.length > 1 && c.phase === 'walkingToSeat',
      ),
    );
    const guest = g.state.characters.find((c) => isGuest(c) && c.phase === 'walkingToSeat');
    if (!guest) throw new Error('no guest');
    const goal = guest.path[guest.path.length - 1];
    // Block a tile of its route (after the one being entered) when legal.
    const blocker = guest.path
      .slice(1, -1)
      .find((t) => validatePlacement(g.state, 'plant_potted', t.x, t.y, 0).ok);
    g.state.money = 1000;
    expect(blocker).toBeDefined();
    if (blocker) {
      expect(
        g.dispatch({
          type: 'buyAndPlace',
          defId: 'plant_potted',
          x: blocker.x,
          y: blocker.y,
          rot: 0,
        }).ok,
      ).toBe(true);
      expect(guest.path.some((t) => t.x === blocker.x && t.y === blocker.y)).toBe(false);
      expect(guest.path[guest.path.length - 1]).toEqual(goal);
    }
    for (let i = 0; i < 400; i++) {
      g.tickOnce();
      checkNobodyStuck(g);
    }
  });
});
