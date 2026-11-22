import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, MAX_TICKS_PER_UPDATE, TICK_MS } from '../../src/data/balance';
import { Game } from '../../src/sim/game';
import { buildWalkGrid, isWalkable } from '../../src/sim/pathfinding';
import { createInitialState } from '../../src/sim/state';
import { DOOR_Y } from '../../src/data/layout';
import { OX, OY } from './helpers';

describe('Game loop', () => {
  it('accumulates real time into fixed ticks and exposes alpha', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    g.update(TICK_MS * 0.5);
    expect(g.state.tick).toBe(0);
    expect(g.alpha).toBeCloseTo(0.5);
    g.update(TICK_MS * 0.75);
    expect(g.state.tick).toBe(1);
    expect(g.alpha).toBeCloseTo(0.25);
  });

  it('applies the speed multiplier', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    g.speed = 2;
    g.update(TICK_MS);
    expect(g.state.tick).toBe(2);
  });

  it('caps ticks per update and drops the backlog', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    g.update(60_000);
    expect(g.state.tick).toBe(MAX_TICKS_PER_UPDATE);
    expect(g.alpha).toBeGreaterThanOrEqual(0);
    expect(g.alpha).toBeLessThan(1);
    g.update(TICK_MS);
    expect(g.state.tick).toBe(MAX_TICKS_PER_UPDATE + 1);
  });

  it('ignores non-positive and NaN deltas', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    g.update(-5);
    g.update(NaN);
    expect(g.state.tick).toBe(0);
  });

  it('simulates the same at 30 and 60 fps', () => {
    const run = (fps: number) => {
      const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
      g.dispatch({ type: 'debugWalkTo', x: 8, y: 10 });
      for (let i = 0; i < fps * 2; i++) g.update(1000 / fps);
      const w = g.state.characters[0];
      return { tick: g.state.tick, x: w?.x, y: w?.y };
    };
    const a = run(30);
    const b = run(60);
    expect(Math.abs(a.tick - b.tick)).toBeLessThanOrEqual(1);
    expect(a.x).toBeCloseTo(b.x ?? 0, 0);
  });
});

describe('debugWalkTo', () => {
  it('walks to a reachable tile and stays on walkable tiles', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    const walk = buildWalkGrid(g.state.grid, g.state.furniture);
    const arrived: string[] = [];
    g.events.on('walkerArrived', (e) => arrived.push(e.id));
    expect(g.dispatch({ type: 'debugWalkTo', x: 7 + OX, y: 2 + OY })).toEqual({ ok: true });
    const w = g.state.characters[0];
    if (!w) throw new Error('no walker');
    for (let i = 0; i < 400 && w.path.length > 0; i++) {
      g.tickOnce();
      // Axis-aligned movement: the tiles the position lies between are both walkable.
      expect(isWalkable(walk, Math.floor(w.x), Math.floor(w.y))).toBe(true);
      expect(isWalkable(walk, Math.ceil(w.x), Math.ceil(w.y))).toBe(true);
    }
    expect(w.x).toBe(7 + OX);
    expect(w.y).toBe(2 + OY);
    expect(arrived).toEqual(['debug1']);
  });

  it('rejects unreachable tiles and changes nothing', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    const before = JSON.stringify(g.state);
    for (const [x, y] of [
      [0 + OX, 5 + OY], // outside (where the wall stands)
      [3 + OX, 6 + OY], // table
      [-1, 3],
      [99, 99],
    ] as const) {
      expect(g.dispatch({ type: 'debugWalkTo', x, y })).toEqual({
        ok: false,
        reason: 'unreachable',
      });
    }
    expect(JSON.stringify(g.state)).toBe(before);
  });

  it('can be redirected mid-walk without teleporting or leaving the grid', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    const w = g.state.characters[0];
    if (!w) throw new Error('no walker');
    g.dispatch({ type: 'debugWalkTo', x: 8 + OX, y: 8 + OY });
    for (let i = 0; i < 5; i++) g.tickOnce();
    const { x, y } = w;
    g.dispatch({ type: 'debugWalkTo', x: 1 + OX, y: 10 + OY });
    g.tickOnce();
    expect(Math.abs(w.x - x) + Math.abs(w.y - y)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 400 && w.path.length > 0; i++) g.tickOnce();
    expect([w.x, w.y]).toEqual([1 + OX, 10 + OY]);
  });

  it('sets facing from the movement direction', () => {
    const g = new Game(createInitialState(DEFAULT_SEED, { debugWalker: true }));
    const w = g.state.characters[0];
    if (!w) throw new Error('no walker');
    g.dispatch({ type: 'debugWalkTo', x: w.x + 1, y: w.y });
    g.tickOnce();
    expect(w.dir).toBe('dr');
    for (let i = 0; i < 4; i++) g.tickOnce(); // arrive first
    g.dispatch({ type: 'debugWalkTo', x: w.x, y: w.y - 3 });
    for (let i = 0; i < 3; i++) g.tickOnce();
    expect(w.dir).toBe('ur');
  });

  it('spawns on a free floor tile next to the door', () => {
    const s = createInitialState(DEFAULT_SEED, { debugWalker: true });
    const walk = buildWalkGrid(s.grid, s.furniture);
    const w = s.characters[0];
    expect(w && isWalkable(walk, w.x, w.y)).toBe(true);
    expect(w?.y).toBe(DOOR_Y - 1);
  });
});
