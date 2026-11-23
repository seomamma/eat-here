import fixtureV5Text from '../fixtures/save-v5.json?raw';
import { describe, expect, it } from 'vitest';
import { FINAL_ROOM, ROOM_GROWTH, growthAtRank, roomAtRank } from '../../src/data/expansion';
import {
  DOOR_X,
  DOOR_Y,
  GRID_HEIGHT,
  GRID_WIDTH,
  LEGACY_OFFSET,
  START_ROOM,
} from '../../src/data/layout';
import { SAVE_VERSION } from '../../src/sim/save';
import { RANKS } from '../../src/data/ranks';
import { growthText } from '../../src/data/strings';
import { isGuest, isStaff } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { tileAt } from '../../src/sim/grid';
import { buildWalkGrid, isWalkable } from '../../src/sim/pathfinding';
import { deserialize, serialize } from '../../src/sim/save';
import { createInitialState, type GameState } from '../../src/sim/state';
import { findFreeSpot, validatePlacement } from '../../src/sim/systems/build';
import { wallSegmentIds } from '../../src/sim/systems/surfaces';

const AT = 1_700_000_000_000;

function fameTo(g: Game, rank: number): void {
  // One point short; the next paid guest tips it over (or addFame directly).
  g.state.fame = (RANKS[rank - 1]?.fame ?? 0) - 1;
}

/** Stand-in for the paid guest: pushes the fame over the threshold through the real path. */
async function rankUpTo(g: Game, rank: number): Promise<void> {
  const { addFame } = await import('../../src/sim/systems/fame');
  fameTo(g, rank);
  addFame(g.state, g.events, 1);
}

function step(g: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    if (g.state.clock.phase === 'report') g.dispatch({ type: 'continueAfterReport' });
    g.tickOnce();
  }
}

function checkInvariants(g: Game): void {
  const walk = buildWalkGrid(g.state.grid, g.state.furniture);
  const seats = new Set<string>();
  for (const c of g.state.characters) {
    const chair = isGuest(c) && c.seatId ? g.state.furniture.find((f) => f.id === c.seatId) : null;
    if (isGuest(c) && c.seatId) {
      expect(seats.has(c.seatId), `double claim ${c.seatId}`).toBe(false);
      seats.add(c.seatId);
    }
    for (const x of new Set([Math.floor(c.x), Math.ceil(c.x)])) {
      for (const y of new Set([Math.floor(c.y), Math.ceil(c.y)])) {
        const onChair = chair && chair.x === x && chair.y === y;
        expect(y > DOOR_Y || isWalkable(walk, x, y) || onChair, `${c.id} at ${x},${y}`).toBe(true);
      }
    }
  }
}

describe('growth schedule', () => {
  it('grows the room as designed and never leaves the allocated grid', () => {
    const w = (r: number) => roomAtRank(r).x1 - roomAtRank(r).x0 + 1;
    const h = (r: number) => roomAtRank(r).y1 - roomAtRank(r).y0 + 1;
    expect(roomAtRank(1)).toEqual(START_ROOM);
    expect([w(1), h(1)]).toEqual([8, 11]);
    expect([w(2), h(2)]).toEqual([11, 11]); // +3 columns on +x
    expect([w(3), h(3)]).toEqual([11, 14]); // +3 rows on -y
    expect([w(4), h(4)]).toEqual([14, 14]); // +3 columns on +x
    expect([w(5), h(5)]).toEqual([16, 16]); // +2 columns on -x, +2 rows on -y
    expect([w(6), h(6)]).toEqual([18, 16]); // +2 columns on +x
    expect(roomAtRank(1).x0 + 0).toBe(1 + LEGACY_OFFSET.x);
    expect(FINAL_ROOM).toEqual(roomAtRank(6));
    for (let r = 1; r <= 6; r++) {
      const room = roomAtRank(r);
      expect(room.x0).toBeGreaterThanOrEqual(1);
      expect(room.y0).toBeGreaterThanOrEqual(1);
      expect(room.x1 + 1).toBeLessThan(GRID_WIDTH); // low wall footprint fits too
      expect(room.y1).toBe(DOOR_Y); // never grows towards +y
      expect(room.y1).toBe(GRID_HEIGHT - 1);
    }
    // Only ranks 2..6 grow; every growth adds something.
    expect(Object.keys(ROOM_GROWTH).map(Number)).toEqual([2, 3, 4, 5, 6]);
    expect(growthAtRank(1)).toBeNull();
  });

  it('describes the growth for the RANK UP modal and the goals', () => {
    expect(growthText({ plusX: 3, minusX: 0, minusY: 0 })).toBe('+3 columns');
    expect(growthText({ plusX: 0, minusX: 0, minusY: 3 })).toBe('+3 rows');
    expect(growthText({ plusX: 0, minusX: 2, minusY: 2 })).toBe('+2 columns, +2 rows');
  });
});

describe('expandRoom through a rank-up', () => {
  it('grows on rank 2 and 3, emits roomExpanded and keeps the door, furniture and styles', async () => {
    const g = new Game(createInitialState(5));
    g.state.rank = 4; // paint needs unlocked styles; rank is reset below
    g.state.money = 5000;
    g.dispatch({ type: 'paintFloor', tiles: [{ x: 5, y: 8 }], style: 'terracotta' });
    g.dispatch({ type: 'paintWall', segments: [`l${START_ROOM.y0 + 2}`], style: 'brick' });
    g.state.rank = 1;
    const furniture = structuredClone(g.state.furniture);
    const styles = structuredClone(g.state.styles);
    const events: { rank: number; added: unknown }[] = [];
    g.events.on('roomExpanded', (e) => events.push(e));
    const ranks: { space: unknown }[] = [];
    g.events.on('rankUp', (e) => ranks.push(e));

    await rankUpTo(g, 2);
    expect(g.state.rank).toBe(2);
    expect(g.state.room).toEqual(roomAtRank(2));
    expect(events).toEqual([
      { rank: 2, added: { plusX: 3, minusX: 0, minusY: 0 }, room: roomAtRank(2) },
    ]);
    expect(ranks[0]?.space).toEqual({ plusX: 3, minusX: 0, minusY: 0 });

    await rankUpTo(g, 3);
    expect(g.state.room).toEqual(roomAtRank(3));
    expect(events).toHaveLength(2);

    // Nothing that existed moved.
    expect(g.state.furniture).toEqual(furniture);
    expect(g.state.styles).toEqual(styles);
    expect(tileAt(g.state.grid, DOOR_X, DOOR_Y)).toBe('door');
    expect(g.state.grid.tiles.filter((t) => t === 'door')).toHaveLength(1);
    // Kitchen checker stays; new floor is plain wood.
    const room = g.state.room;
    expect(tileAt(g.state.grid, START_ROOM.x0, START_ROOM.y0)).toBe('floor_tile');
    expect(tileAt(g.state.grid, START_ROOM.x1 + 1, START_ROOM.y0 + 5)).toBe('floor_wood');
    expect(tileAt(g.state.grid, START_ROOM.x0, room.y0)).toBe('floor_wood');
    // Floor tile count matches the rectangle (door included), outside stays outside.
    const floors = g.state.grid.tiles.filter((t) => t !== 'outside').length;
    expect(floors).toBe((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1));
  });

  it('derives the walls from the rectangle: old segments keep their ids, new ones are default', async () => {
    const g = new Game(createInitialState(5));
    const before = wallSegmentIds(g.state.room);
    expect(before).toHaveLength(8 + 11);
    await rankUpTo(g, 2);
    await rankUpTo(g, 3);
    const after = wallSegmentIds(g.state.room);
    expect(after).toHaveLength(11 + 14); // 11 columns along the back-right wall, 14 rows on the back-left
    for (const id of before) expect(after).toContain(id);
    expect(after).toContain(`l${g.state.room.y0}`);
    expect(after).toContain(`r${g.state.room.x1}`);
    expect(Object.keys(g.state.styles.wall)).toEqual([]);
    // Fresh segments are paintable, ones outside the room are not.
    g.state.rank = 3;
    g.state.money = 1000;
    expect(
      g.dispatch({ type: 'paintWall', segments: [`r${g.state.room.x1}`], style: 'brick' }).ok,
    ).toBe(true);
    expect(
      g.dispatch({ type: 'paintWall', segments: [`r${g.state.room.x1 + 1}`], style: 'brick' }),
    ).toEqual({
      ok: false,
      reason: 'unknownSegment',
    });
  });

  it('allows placement in the new area, refuses outside, and keeps everything reachable', async () => {
    const g = new Game(createInitialState(5));
    g.state.money = 5000;
    const inNew = { x: START_ROOM.x1 + 2, y: START_ROOM.y0 + 4 };
    const out = (s: GameState) => validatePlacement(s, 'plant_potted', inNew.x, inNew.y, 0);
    expect(out(g.state)).toEqual({ ok: false, reason: 'notFloor' });
    await rankUpTo(g, 2);
    expect(out(g.state)).toEqual({ ok: true });
    expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...inNew, rot: 0 }).ok).toBe(
      true,
    );
    // Beyond the new edge is still outside; so is the row behind the back wall.
    expect(validatePlacement(g.state, 'plant_potted', g.state.room.x1 + 1, inNew.y, 0)).toEqual({
      ok: false,
      reason: 'notFloor',
    });
    expect(validatePlacement(g.state, 'plant_potted', inNew.x, g.state.room.y0 - 1, 0)).toEqual({
      ok: false,
      reason: 'notFloor',
    });
    const walk = buildWalkGrid(g.state.grid, g.state.furniture);
    expect(isWalkable(walk, g.state.room.x1, g.state.room.y1 - 1)).toBe(true);
    // The free-spot search stays inside the unlocked room.
    const spot = findFreeSpot(g.state, 'plant_potted');
    expect(spot).not.toBeNull();
    const r = g.state.room;
    expect(spot && spot.x >= r.x0 && spot.x <= r.x1 && spot.y >= r.y0 && spot.y <= r.y1).toBe(true);
  });
});

describe('growth during play', () => {
  function run(seed: number): { json: string; rooms: number } {
    const g = new Game(createInitialState(seed));
    let rooms = 0;
    g.events.on('roomExpanded', () => rooms++);
    g.state.money = 3000;
    // Everyone present while the room grows: guests, staff, jobs in flight.
    let sawGuests = false;
    let raised = 0;
    for (let i = 0; i < 20_000 && g.state.clock.day <= 6; i++) {
      if (g.state.clock.phase === 'report') g.dispatch({ type: 'continueAfterReport' });
      const guests = g.state.characters.filter(isGuest).length;
      if (guests >= 3 && raised < 2 && g.state.clock.phase === 'open') {
        sawGuests = true;
        raised++;
        fameTo(g, raised + 1);
      }
      g.tickOnce();
      if (i % 7 === 0) checkInvariants(g);
      if (g.state.rank === 3 && raised === 2) {
        // Use the new space: a table and chairs in the grown room.
        const r = g.state.room;
        const spot = { x: r.x1 - 1, y: r.y0 + 2 };
        if (!g.state.furniture.some((f) => f.x === spot.x && f.y === spot.y)) {
          g.dispatch({ type: 'buyAndPlace', defId: 'table_small', ...spot, rot: 0 });
          g.dispatch({
            type: 'buyAndPlace',
            defId: 'chair_wood',
            x: spot.x - 1,
            y: spot.y,
            rot: 1,
          });
          g.dispatch({
            type: 'buyAndPlace',
            defId: 'chair_wood',
            x: spot.x + 1,
            y: spot.y,
            rot: 3,
          });
        }
      }
    }
    expect(sawGuests).toBe(true);
    expect(g.state.rank).toBeGreaterThanOrEqual(3);
    // Let the day end: nobody stays in the restaurant, no claims remain.
    g.state.guestSpawn.enabled = false;
    for (let i = 0; i < 6000 && g.state.characters.some(isGuest); i++) g.tickOnce();
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    for (const s of g.state.characters.filter(isStaff)) expect(s.jobId).toBeNull();
    return { json: serialize(g.state, AT), rooms };
  }

  it('runs across the rank 2 and 3 expansions: no stranding, no double claims, everyone leaves', () => {
    const a = run(21);
    expect(a.rooms).toBe(2);
  });

  it('is deterministic', () => {
    expect(run(22).json).toBe(run(22).json);
  });
});

describe('migration v5 -> v6', () => {
  const raw = JSON.parse(fixtureV5Text) as { version: number; state: GameState };
  const res = deserialize(fixtureV5Text);

  it('translates furniture, style keys, characters (position, path, home, wait spot) and the room', () => {
    expect(raw.version).toBe(5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = res.state;
    const { x: ox, y: oy } = LEGACY_OFFSET;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.room).toEqual(START_ROOM);
    expect(s.grid.width).toBe(GRID_WIDTH);
    expect(s.grid.height).toBe(GRID_HEIGHT);
    // A furniture piece.
    const oven = raw.state.furniture.find((f) => f.defId === 'oven_pizza');
    const newOven = s.furniture.find((f) => f.id === oven?.id);
    expect(newOven).toMatchObject({ x: (oven?.x ?? 0) + ox, y: (oven?.y ?? 0) + oy });
    expect(s.furniture).toHaveLength(raw.state.furniture.length);
    // Style keys: floor "x,y" and wall l<y> / r<x>.
    expect(raw.state.styles.floor).toEqual({ '4,6': 'terracotta', '5,6': 'terracotta' });
    expect(s.styles.floor).toEqual({
      [`${4 + ox},${6 + oy}`]: 'terracotta',
      [`${5 + ox},${6 + oy}`]: 'terracotta',
    });
    expect(s.styles.wall).toEqual({ [`l${5 + oy}`]: 'brick', [`r${3 + ox}`]: 'brick' });
    // Characters: a walking guest keeps its path shifted, staff keep home, a waiting guest its spot.
    for (const old of raw.state.characters) {
      const now = s.characters.find((c) => c.id === old.id);
      expect(now).toBeDefined();
      if (!now) continue;
      expect(now.x).toBeCloseTo(old.x + ox, 9);
      expect(now.y).toBeCloseTo(old.y + oy, 9);
      expect(now.path).toEqual(old.path.map((p) => ({ x: p.x + ox, y: p.y + oy })));
      if (isStaff(old) && isStaff(now)) {
        expect(now.home).toEqual({ x: old.home.x + ox, y: old.home.y + oy });
        if (old.target) expect(now.target).toEqual({ x: old.target.x + ox, y: old.target.y + oy });
      }
      if (isGuest(old) && isGuest(now) && old.waitSpot) {
        expect(now.waitSpot).toEqual({ x: old.waitSpot.x + ox, y: old.waitSpot.y + oy });
      }
    }
    expect(raw.state.characters.some((c) => c.path.length > 0)).toBe(true);
    expect(raw.state.characters.some((c) => isGuest(c) && c.waitSpot)).toBe(true);
    // The door and the tiles moved with it; the start layout equals a fresh game's.
    expect(tileAt(s.grid, DOOR_X, DOOR_Y)).toBe('door');
    const fresh = createInitialState(1);
    expect(s.grid.tiles).toEqual(fresh.grid.tiles);
  });

  it('plays on: everyone leaves by the report and nobody gets stuck', () => {
    if (!res.ok) throw new Error('load failed');
    const g = new Game(structuredClone(res.state));
    let ticks = 0;
    while (g.state.clock.phase !== 'report' && ticks++ < 20_000) {
      g.tickOnce();
      if (ticks % 5 === 0) checkInvariants(g);
    }
    expect(g.state.clock.phase).toBe('report');
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    // And the next day works too, after a save round trip.
    const again = deserialize(serialize(g.state, AT));
    expect(again.ok).toBe(true);
    step(new Game(again.ok ? again.state : g.state), 600);
  });

  it('gives a higher-rank v5 save the room of its rank', () => {
    const f = JSON.parse(fixtureV5Text) as { state: { rank: number } };
    f.state.rank = 3;
    const r = deserialize(JSON.stringify(f));
    expect(r.ok && r.state.room).toEqual(roomAtRank(3));
  });

  it('rejects a broken room', () => {
    const f = JSON.parse(serialize(createInitialState(1), AT)) as { state: { room: unknown } };
    f.state.room = { x0: 5, y0: 5, x1: 2, y1: 9 };
    expect(deserialize(JSON.stringify(f))).toEqual({ ok: false, reason: 'bad:room' });
    f.state.room = null;
    expect(deserialize(JSON.stringify(f))).toEqual({ ok: false, reason: 'bad:room' });
  });
});
