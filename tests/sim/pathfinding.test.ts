import { describe, expect, it } from 'vitest';
import { buildWalkGrid, findPath, isWalkable, type WalkGrid } from '../../src/sim/pathfinding';
import { createInitialState } from '../../src/sim/state';
import { DOOR_X, DOOR_Y } from '../../src/data/layout';
import { OX, OY } from './helpers';

/** '.' walkable, '#' blocked. */
function grid(rows: string[]): WalkGrid {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    walkable: rows.flatMap((r) => [...r].map((c) => c === '.')),
  };
}

function valid(w: WalkGrid, p: { x: number; y: number }[]): boolean {
  return p.every((t, i) => {
    if (!isWalkable(w, t.x, t.y)) return false;
    const prev = p[i - 1];
    return !prev || Math.abs(prev.x - t.x) + Math.abs(prev.y - t.y) === 1;
  });
}

describe('findPath', () => {
  it('finds a straight line', () => {
    const w = grid(['.....']);
    const p = findPath(w, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(p).toHaveLength(5);
    expect(p?.[0]).toEqual({ x: 0, y: 0 });
    expect(p?.[4]).toEqual({ x: 4, y: 0 });
  });

  it('goes around an obstacle with the shortest route', () => {
    const w = grid(['.....', '.###.', '.....']);
    const p = findPath(w, { x: 0, y: 1 }, { x: 4, y: 1 });
    expect(p).not.toBeNull();
    expect(p).toHaveLength(7); // up/down 1, across 4, back 1 = 6 steps
    expect(valid(w, p ?? [])).toBe(true);
  });

  it('returns null for an enclosed goal', () => {
    const w = grid(['..#..', '..#..', '..#..']);
    expect(findPath(w, { x: 0, y: 0 }, { x: 4, y: 2 })).toBeNull();
  });

  it('returns null when start or goal is blocked or out of bounds', () => {
    const w = grid(['.#.']);
    expect(findPath(w, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(findPath(w, { x: 1, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(findPath(w, { x: 0, y: 0 }, { x: 9, y: 0 })).toBeNull();
  });

  it('returns a single tile when start = goal', () => {
    const w = grid(['..']);
    expect(findPath(w, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([{ x: 1, y: 0 }]);
  });

  it('is deterministic', () => {
    const w = grid(['......', '......', '......', '......']);
    const a = findPath(w, { x: 0, y: 0 }, { x: 5, y: 3 });
    const b = findPath(w, { x: 0, y: 0 }, { x: 5, y: 3 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(9);
  });
});

describe('start room walk grid', () => {
  const s = createInitialState();
  const w = buildWalkGrid(s.grid, s.furniture);

  it('blocks walls and furniture, allows floor and door', () => {
    expect(isWalkable(w, 0 + OX, 5 + OY)).toBe(false); // outside (where the wall stands)
    expect(isWalkable(w, 3 + OX, 6 + OY)).toBe(false); // table
    expect(isWalkable(w, 5 + OX, 3 + OY)).toBe(false); // counter
    expect(isWalkable(w, 6 + OX, 3 + OY)).toBe(false); // counter (2 wide)
    expect(isWalkable(w, DOOR_X, DOOR_Y)).toBe(true); // door
    expect(isWalkable(w, 5 + OX, 5 + OY)).toBe(true);
  });

  it('every path from the door never crosses blocked tiles', () => {
    for (let y = 0; y < s.grid.height; y++) {
      for (let x = 0; x < s.grid.width; x++) {
        const p = findPath(w, { x: DOOR_X, y: DOOR_Y }, { x, y });
        if (isWalkable(w, x, y)) {
          expect(p).not.toBeNull();
          expect(valid(w, p ?? [])).toBe(true);
        } else {
          expect(p).toBeNull();
        }
      }
    }
  });
});
