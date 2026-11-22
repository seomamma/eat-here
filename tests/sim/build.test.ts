import { describe, expect, it } from 'vitest';
import { FURNITURE, type FurnitureDefId } from '../../src/data/furniture';
import { SHOP_ITEMS } from '../../src/data/shop';
import { STRINGS } from '../../src/data/strings';
import { isGuest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { createInitialState, type GameState } from '../../src/sim/state';
import {
  findFreeSpot,
  isChairUsable,
  validateBuy,
  validatePlacement,
} from '../../src/sim/systems/build';
import { DAY_TICKS } from '../../src/sim/time';

/** Puts a piece straight into the state (no validation) to build up a scenario. */
function put(
  state: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: 0 | 1 = 0,
): string {
  const id = `t${state.furniture.length}`;
  state.furniture.push({ id, defId, x, y, rot, level: 1 });
  return id;
}

function idAt(state: GameState, x: number, y: number): string {
  const f = state.furniture.find((o) => o.x === x && o.y === y);
  if (!f) throw new Error(`no furniture at ${x},${y}`);
  return f.id;
}

const reason = (r: { ok: boolean } & { reason?: string }) => (r.ok ? 'ok' : r.reason);

describe('validatePlacement', () => {
  it('accepts a free floor tile', () => {
    const s = createInitialState(1);
    expect(validatePlacement(s, 'plant_potted', 7, 5, 0)).toEqual({ ok: true });
  });

  it('rejects out of bounds', () => {
    const s = createInitialState(1);
    for (const [x, y] of [
      [-1, 5],
      [5, -1],
      [10, 5],
      [5, 12],
    ] as const) {
      expect(reason(validatePlacement(s, 'plant_potted', x, y, 0))).toBe('outOfBounds');
    }
  });

  it('rejects walls', () => {
    const s = createInitialState(1);
    expect(reason(validatePlacement(s, 'plant_potted', 0, 5, 0))).toBe('notFloor');
    expect(reason(validatePlacement(s, 'plant_potted', 5, 0, 0))).toBe('notFloor');
    expect(reason(validatePlacement(s, 'plant_potted', 9, 5, 0))).toBe('notFloor');
  });

  it('keeps the door tile free', () => {
    const s = createInitialState(1);
    expect(reason(validatePlacement(s, 'plant_potted', 4, 11, 0))).toBe('blocksWay');
  });

  it('rejects overlap with other furniture', () => {
    const s = createInitialState(1);
    expect(reason(validatePlacement(s, 'plant_potted', 3, 6, 0))).toBe('overlap'); // table
    expect(reason(validatePlacement(s, 'plant_potted', 6, 3, 0))).toBe('overlap'); // pass, 2nd tile
  });

  it('ignores the piece being moved', () => {
    const s = createInitialState(1);
    const table = idAt(s, 3, 6);
    expect(reason(validatePlacement(s, 'table_small', 3, 6, 0))).toBe('overlap');
    expect(validatePlacement(s, 'table_small', 3, 6, 0, table)).toEqual({ ok: true });
    // A 2x1 piece shifted by one tile overlaps its own old footprint.
    const pass = idAt(s, 5, 3);
    expect(validatePlacement(s, 'counter_pass', 6, 3, 0, pass)).toEqual({ ok: true });
  });

  it('blocks the way to the door', () => {
    const s = createInitialState(1);
    put(s, 'plant_potted', 3, 11);
    put(s, 'plant_potted', 5, 11);
    expect(reason(validatePlacement(s, 'plant_potted', 4, 10, 0))).toBe('blocksWay');
    // Elsewhere is still fine.
    expect(validatePlacement(s, 'plant_potted', 7, 5, 0)).toEqual({ ok: true });
  });

  it('blocks the oven use spot and the only path to it', () => {
    const s = createInitialState(1);
    expect(reason(validatePlacement(s, 'plant_potted', 2, 2, 0))).toBe('blocksWay');
    put(s, 'plant_potted', 1, 2);
    put(s, 'plant_potted', 3, 2);
    expect(reason(validatePlacement(s, 'plant_potted', 2, 3, 0))).toBe('blocksWay');
  });

  it('blocks waiting spots and staff idle spots', () => {
    const s = createInitialState(1);
    expect(reason(validatePlacement(s, 'plant_potted', 3, 10, 0))).toBe('blocksWay');
    expect(reason(validatePlacement(s, 'plant_potted', 4, 2, 0))).toBe('blocksWay'); // chef home
    expect(reason(validatePlacement(s, 'plant_potted', 6, 4, 0))).toBe('blocksWay'); // waiter home
  });

  it('refuses to wall a chair in', () => {
    const s = createInitialState(1);
    // Chair at (2,6): table to the right, so its free neighbours are (1,6), (2,5), (2,7).
    put(s, 'plant_potted', 1, 6);
    put(s, 'plant_potted', 2, 5);
    expect(reason(validatePlacement(s, 'plant_potted', 2, 7, 0))).toBe('blocksWay');
  });

  it('uses the rotated footprint of 2x1 pieces', () => {
    const s = createInitialState(1);
    const oven = idAt(s, 2, 1);
    // rot 0 would put the second tile into the east wall, rot 1 runs down instead.
    expect(reason(validatePlacement(s, 'oven_pizza', 8, 6, 0, oven))).toBe('notFloor');
    expect(reason(validatePlacement(s, 'oven_pizza', 7, 6, 1, oven))).toBe('ok');
    expect(reason(validatePlacement(s, 'oven_pizza', 7, 11, 1, oven))).toBe('outOfBounds');
    // rot 1 covers (7,7), rot 0 covers (8,6).
    const plant = put(s, 'plant_potted', 7, 7);
    expect(reason(validatePlacement(s, 'oven_pizza', 7, 6, 1, oven))).toBe('overlap');
    s.furniture = s.furniture.filter((f) => f.id !== plant);
    put(s, 'plant_potted', 8, 6);
    expect(reason(validatePlacement(s, 'oven_pizza', 7, 6, 0, oven))).toBe('overlap');
  });

  it('findFreeSpot returns a valid tile near the centre', () => {
    const s = createInitialState(1);
    const spot = findFreeSpot(s, 'plant_potted');
    expect(spot).not.toBeNull();
    expect(validatePlacement(s, 'plant_potted', spot?.x ?? -1, spot?.y ?? -1, 0).ok).toBe(true);
  });
});

describe('isChairUsable', () => {
  it('needs an adjacent table', () => {
    const s = createInitialState(1);
    const chair = s.furniture.find((f) => f.id === idAt(s, 2, 6));
    if (!chair) throw new Error('no chair');
    expect(isChairUsable(s, chair)).toBe(true);
    const lone = { id: 'x', defId: 'chair_wood', x: 7, y: 5, rot: 0, level: 1 } as const;
    expect(isChairUsable(s, lone)).toBe(false);
  });
});

describe('buyAndPlace', () => {
  const price = FURNITURE.plant_potted.price;

  it('only sells shop items', () => {
    expect(SHOP_ITEMS).toContain('plant_potted');
    const s = createInitialState(1);
    s.money = 5000;
    expect(reason(validateBuy(s, 'oven_pizza', 7, 5, 0))).toBe('notInShop');
  });

  it('is refused outside prep', () => {
    const g = new Game(createInitialState(1));
    g.state.money = 1000;
    g.dispatch({ type: 'openRestaurant' });
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 7, y: 5, rot: 0 })).toEqual({
      ok: false,
      reason: 'notPrep',
    });
    expect(g.state.money).toBe(1000);
    expect(g.state.furniture).toHaveLength(8);
  });

  it('is refused without enough money and changes nothing', () => {
    const g = new Game(createInitialState(1));
    g.state.money = price - 1;
    const moneyEvents: number[] = [];
    g.events.on('moneyChanged', (e) => moneyEvents.push(e.money));
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 7, y: 5, rot: 0 })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    expect(g.state.money).toBe(price - 1);
    expect(g.state.furniture).toHaveLength(8);
    expect(moneyEvents).toEqual([]);
  });

  it('is refused on an invalid tile and keeps the money', () => {
    const g = new Game(createInitialState(1));
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 4, y: 11, rot: 0 })).toEqual(
      {
        ok: false,
        reason: 'blocksWay',
      },
    );
    expect(g.state.money).toBe(300);
  });

  it('deducts the price exactly once and adds the piece', () => {
    const g = new Game(createInitialState(1));
    const placed: unknown[] = [];
    const moneyEvents: number[] = [];
    g.events.on('furniturePlaced', (e) => placed.push(e));
    g.events.on('moneyChanged', (e) => moneyEvents.push(e.money));
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 7, y: 5, rot: 0 })).toEqual({
      ok: true,
    });
    expect(g.state.money).toBe(300 - price);
    expect(g.state.spentOnBuilding).toBe(price);
    expect(moneyEvents).toEqual([300 - price]);
    expect(placed).toHaveLength(1);
    expect(g.state.furniture).toHaveLength(9);
    const ids = g.state.furniture.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The same tile is taken now.
    g.state.money = 1000;
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 7, y: 5, rot: 0 })).toEqual({
      ok: false,
      reason: 'overlap',
    });
    expect(g.state.money).toBe(1000);
  });

  it('rebuilds the walk grid so the new piece blocks paths', () => {
    const g = new Game(createInitialState(1));
    g.tickOnce();
    g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 7, y: 5, rot: 0 });
    g.dispatch({ type: 'debugWalkTo', x: 7, y: 5 }); // no walker: just must not throw
    expect(g.state.furniture.some((f) => f.x === 7 && f.y === 5)).toBe(true);
  });
});

describe('moveFurniture', () => {
  it('is refused outside prep', () => {
    const g = new Game(createInitialState(1));
    g.dispatch({ type: 'openRestaurant' });
    const id = idAt(g.state, 3, 6);
    expect(g.dispatch({ type: 'moveFurniture', id, x: 3, y: 8, rot: 0 })).toEqual({
      ok: false,
      reason: 'notPrep',
    });
  });

  it('moves a valid piece and refuses an invalid one', () => {
    const g = new Game(createInitialState(1));
    const moved: unknown[] = [];
    g.events.on('furnitureMoved', (e) => moved.push(e));
    const id = idAt(g.state, 3, 6);
    expect(g.dispatch({ type: 'moveFurniture', id, x: 3, y: 8, rot: 0 })).toEqual({ ok: true });
    expect(g.state.furniture.find((f) => f.id === id)).toMatchObject({ x: 3, y: 8 });
    expect(moved).toHaveLength(1);
    expect(g.dispatch({ type: 'moveFurniture', id, x: 0, y: 8, rot: 0 })).toMatchObject({
      ok: false,
    });
    expect(g.state.furniture.find((f) => f.id === id)).toMatchObject({ x: 3, y: 8 });
    expect(g.state.money).toBe(300);
  });

  it('refuses unknown ids', () => {
    const g = new Game(createInitialState(1));
    expect(g.dispatch({ type: 'moveFurniture', id: 'nope', x: 3, y: 8, rot: 0 })).toMatchObject({
      ok: false,
    });
  });
});

/** Runs one open day to the report; returns what happened at which chair. */
function playDay(g: Game) {
  const seatedAt: { x: number; y: number }[] = [];
  const decor: { chairId: string; points: number }[] = [];
  const left: string[] = [];
  g.events.on('guestSeated', (e) => {
    const chair = g.state.furniture.find((f) => f.id === e.seatId);
    if (chair) seatedAt.push({ x: chair.x, y: chair.y });
  });
  g.events.on('guestLeft', (e) => left.push(e.reason));
  g.events.on('paid', (e) => {
    const guest = g.state.characters.find((c) => c.id === e.guestId);
    if (!guest || !isGuest(guest) || !guest.seatId) return;
    const points = guest.happinessLog
      .filter((h) => h.reason === 'decor')
      .reduce((n, h) => n + h.points, 0);
    decor.push({ chairId: guest.seatId, points });
  });
  let served = 0;
  g.events.on('paid', () => served++);
  g.dispatch({ type: 'openRestaurant' });
  for (let i = 0; i < DAY_TICKS * 3 && g.state.clock.phase !== 'report'; i++) g.tickOnce();
  return { seatedAt, decor, left, served };
}

describe('after building', () => {
  it('guests use the moved tables and chairs; nobody gets stuck', () => {
    const g = new Game(createInitialState(1));
    const [c1, c2, t1] = [idAt(g.state, 2, 6), idAt(g.state, 4, 6), idAt(g.state, 3, 6)];
    expect(g.dispatch({ type: 'moveFurniture', id: c1, x: 1, y: 9, rot: 0 }).ok).toBe(true);
    expect(g.dispatch({ type: 'moveFurniture', id: c2, x: 3, y: 9, rot: 1 }).ok).toBe(true);
    expect(g.dispatch({ type: 'moveFurniture', id: t1, x: 2, y: 9, rot: 0 }).ok).toBe(true);
    const day = playDay(g);
    expect(g.state.clock.phase).toBe('report');
    expect(day.served).toBeGreaterThan(5);
    const old = [
      [2, 6],
      [4, 6],
    ];
    expect(day.seatedAt.some((p) => old.some(([x, y]) => p.x === x && p.y === y))).toBe(false);
    expect(day.seatedAt.some((p) => p.y === 9)).toBe(true);
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
  });

  it('never seats guests on chairs without a table', () => {
    const g = new Game(createInitialState(1));
    // Move table 1 away: its two chairs become orphans.
    expect(
      g.dispatch({ type: 'moveFurniture', id: idAt(g.state, 3, 6), x: 7, y: 5, rot: 0 }).ok,
    ).toBe(true);
    const orphans = [idAt(g.state, 2, 6), idAt(g.state, 4, 6)];
    for (const f of g.state.furniture) {
      if (orphans.includes(f.id)) expect(isChairUsable(g.state, f)).toBe(false);
    }
    const seated: string[] = [];
    g.events.on('guestSeated', (e) => seated.push(e.seatId));
    const day = playDay(g);
    expect(day.served).toBeGreaterThan(3);
    expect(seated.length).toBeGreaterThan(0);
    for (const o of orphans) expect(seated).not.toContain(o);
  });

  it('a plant near a chair gives its guests decor points; a far one gives none', () => {
    const g = new Game(createInitialState(1));
    g.state.money = 1000;
    // Chair (2,6) is within radius 2 of (2,8); chairs at (5,8)/(7,8) are 3+ tiles away.
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', x: 2, y: 8, rot: 0 }).ok).toBe(
      true,
    );
    const day = playDay(g);
    const near = idAt(g.state, 2, 6);
    const nearHits = day.decor.filter((d) => d.chairId === near);
    const farHits = day.decor.filter((d) => d.chairId === idAt(g.state, 7, 8));
    expect(nearHits.length).toBeGreaterThan(0);
    expect(nearHits.every((d) => d.points === FURNITURE.plant_potted.appeal[0])).toBe(true);
    expect(farHits.length).toBeGreaterThan(0);
    expect(farHits.every((d) => d.points === 0)).toBe(true);
  });

  it('has a string for the decor reason', () => {
    expect(STRINGS.guestCard.reasons.decor).toBe('Lovely decor');
  });
});
