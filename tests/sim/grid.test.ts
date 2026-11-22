import { describe, expect, it } from 'vitest';
import { FURNITURE } from '../../src/data/furniture';
import {
  FACING_STEP,
  buildOccupancy,
  chairFacing,
  canPlace,
  furnitureAt,
  footprintTiles,
  rotatedFootprint,
  rotatedUseSpots,
  tileAt,
} from '../../src/sim/grid';
import { createInitialState } from '../../src/sim/state';

describe('occupancy', () => {
  it('maps a 1x1 piece to a single tile', () => {
    const s = {
      furniture: [{ id: 'a', defId: 'table_small', x: 3, y: 4, rot: 0, level: 1 }],
    } as const;
    expect(furnitureAt(s, 3, 4)).toBe('a');
    expect(furnitureAt(s, 4, 4)).toBeUndefined();
  });

  it('maps a 2x1 piece to two tiles', () => {
    const s = {
      furniture: [{ id: 'o', defId: 'oven_pizza', x: 2, y: 1, rot: 0, level: 1 }],
    } as const;
    expect(furnitureAt(s, 2, 1)).toBe('o');
    expect(furnitureAt(s, 3, 1)).toBe('o');
    expect(furnitureAt(s, 4, 1)).toBeUndefined();
    expect(furnitureAt(s, 2, 2)).toBeUndefined();
    expect(buildOccupancy(s.furniture).size).toBe(2);
  });
});

describe('canPlace', () => {
  const s = createInitialState();

  it('accepts free floor', () => {
    expect(canPlace(s, 'plant_potted', 1, 10)).toBe(true);
    expect(canPlace(s, 'counter_pass', 6, 10)).toBe(true);
  });

  it('rejects walls, door and out of bounds', () => {
    expect(canPlace(s, 'plant_potted', 0, 5)).toBe(false);
    expect(canPlace(s, 'plant_potted', 4, 0)).toBe(false);
    expect(canPlace(s, 'plant_potted', 4, 11)).toBe(false); // door
    expect(canPlace(s, 'plant_potted', -1, 5)).toBe(false);
    expect(canPlace(s, 'plant_potted', 10, 5)).toBe(false);
    expect(canPlace(s, 'plant_potted', 5, 12)).toBe(false);
  });

  it('rejects a 2x1 that sticks into a wall or out of the grid', () => {
    expect(canPlace(s, 'oven_pizza', 8, 5)).toBe(false); // x=9 is wall
    expect(canPlace(s, 'oven_pizza', 9, 5)).toBe(false);
  });

  it('rejects overlap with existing furniture, including partial 2x1 overlap', () => {
    expect(canPlace(s, 'plant_potted', 3, 6)).toBe(false); // table
    expect(canPlace(s, 'plant_potted', 3, 1)).toBe(false); // second tile of oven
    expect(canPlace(s, 'counter_pass', 4, 1)).toBe(true);
    expect(canPlace(s, 'counter_pass', 3, 1)).toBe(false);
  });
});

describe('rotation', () => {
  const s = createInitialState();

  it('swaps the footprint for rot 1', () => {
    expect(rotatedFootprint('oven_pizza', 0)).toEqual([2, 1]);
    expect(rotatedFootprint('oven_pizza', 1)).toEqual([1, 2]);
    expect(rotatedFootprint('table_small', 1)).toEqual([1, 1]);
  });

  it('covers a 2x1 oven horizontally at rot 0 and vertically at rot 1', () => {
    expect(footprintTiles('oven_pizza', 5, 5, 0)).toEqual([
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]);
    expect(footprintTiles('oven_pizza', 5, 5, 1)).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ]);
  });

  it('uses the rotated footprint for occupancy', () => {
    const f = [{ id: 'o', defId: 'oven_pizza', x: 5, y: 5, rot: 1, level: 1 }] as const;
    expect(furnitureAt({ furniture: f }, 5, 6)).toBe('o');
    expect(furnitureAt({ furniture: f }, 6, 5)).toBeUndefined();
    expect([...buildOccupancy(f).keys()].sort()).toEqual(['5,5', '5,6']);
  });

  it('checks canPlace against the rotated footprint', () => {
    // x = 8 is the last floor column: a horizontal 2x1 sticks into the wall, a vertical one fits.
    expect(canPlace(s, 'oven_pizza', 8, 5, 0)).toBe(false);
    expect(canPlace(s, 'oven_pizza', 8, 5, 1)).toBe(true);
    // A vertical oven at (4, 10) would cover the door tile (4, 11).
    expect(canPlace(s, 'oven_pizza', 4, 10, 1)).toBe(false);
    expect(canPlace(s, 'oven_pizza', 6, 10, 1)).toBe(true);
    // Overlap with the existing table at (3, 6) only when the rotated tiles touch it.
    expect(canPlace(s, 'oven_pizza', 3, 5, 1)).toBe(false);
    expect(canPlace(s, 'oven_pizza', 3, 5, 0)).toBe(true);
  });

  it('rotates use spots and facings', () => {
    expect(rotatedUseSpots('oven_pizza', 0)).toEqual([{ dx: 0, dy: 1, facing: 'up' }]);
    expect(rotatedUseSpots('oven_pizza', 1)).toEqual([{ dx: 1, dy: 0, facing: 'left' }]);
    expect(rotatedUseSpots('counter_pass', 1)).toEqual([
      { dx: -1, dy: 0, facing: 'right' },
      { dx: 1, dy: 0, facing: 'left' },
    ]);
  });
});

describe('rotation 2 and 3 (back views)', () => {
  it('swaps the footprint on odd rotations only', () => {
    expect([0, 1, 2, 3].map((r) => rotatedFootprint('oven_pizza', r as 0 | 1 | 2 | 3))).toEqual([
      [2, 1],
      [1, 2],
      [2, 1],
      [1, 2],
    ]);
  });

  it('turns a 2x1 oven around: chef stands behind it at rot 2, to its side at rot 3', () => {
    expect(rotatedUseSpots('oven_pizza', 2)).toEqual([{ dx: 1, dy: -1, facing: 'down' }]);
    expect(rotatedUseSpots('oven_pizza', 3)).toEqual([{ dx: -1, dy: 1, facing: 'right' }]);
    expect(footprintTiles('oven_pizza', 5, 5, 3)).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ]);
  });

  it('keeps the pass counter spots on opposite sides and in order for every rot', () => {
    expect(rotatedUseSpots('counter_pass', 2)).toEqual([
      { dx: 1, dy: 1, facing: 'up' },
      { dx: 1, dy: -1, facing: 'down' },
    ]);
    expect(rotatedUseSpots('counter_pass', 3)).toEqual([
      { dx: 1, dy: 1, facing: 'left' },
      { dx: -1, dy: 1, facing: 'right' },
    ]);
  });

  it('a chair faces down, right, up, left for rot 0..3', () => {
    expect(([0, 1, 2, 3] as const).map(chairFacing)).toEqual(['down', 'right', 'up', 'left']);
    for (const rot of [0, 1, 2, 3] as const) {
      expect(rotatedUseSpots('chair_wood', rot)[0]).toMatchObject({ dx: 0, dy: 0 });
      expect(rotatedFootprint('chair_wood', rot)).toEqual([1, 1]);
    }
  });

  it('every use spot of every piece stays next to its footprint for all rotations', () => {
    for (const defId of ['oven_pizza', 'counter_pass'] as const) {
      for (const rot of [0, 1, 2, 3] as const) {
        const tiles = footprintTiles(defId, 5, 5, rot);
        for (const sp of rotatedUseSpots(defId, rot)) {
          const t = { x: 5 + sp.dx, y: 5 + sp.dy };
          expect(tiles.some((o) => o.x === t.x && o.y === t.y)).toBe(false);
          // The spot looks at the piece: one step in its facing lands on the footprint.
          const step = FACING_STEP[sp.facing];
          expect(tiles.some((o) => o.x === t.x + step.x && o.y === t.y + step.y)).toBe(true);
        }
      }
    }
  });
});

describe('initial layout', () => {
  const s = createInitialState();
  const count = (kind: string) =>
    s.furniture.filter((f) => FURNITURE[f.defId].kind === kind).length;

  it('has the expected pieces', () => {
    expect(s.grid.width).toBe(10);
    expect(s.grid.height).toBe(12);
    expect(count('table')).toBe(2);
    expect(count('chair')).toBe(4);
    expect(count('oven')).toBe(1);
    expect(count('pass')).toBe(1);
  });

  it('has unique ids, everything on floor, nothing overlapping', () => {
    expect(new Set(s.furniture.map((f) => f.id)).size).toBe(s.furniture.length);
    const seen = new Set<string>();
    for (const f of s.furniture) {
      for (const t of footprintTiles(f.defId, f.x, f.y, f.rot)) {
        const tile = tileAt(s.grid, t.x, t.y);
        expect(['floor_wood', 'floor_tile']).toContain(tile);
        const key = `${t.x},${t.y}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('has a single door in the bottom row and walls around the room', () => {
    expect(s.grid.tiles.filter((t) => t === 'door')).toHaveLength(1);
    expect(tileAt(s.grid, 4, 11)).toBe('door');
    for (let x = 0; x < 10; x++) expect(tileAt(s.grid, x, 0)).toBe('wall');
    for (let y = 0; y < 12; y++) {
      expect(tileAt(s.grid, 0, y)).toBe('wall');
      expect(tileAt(s.grid, 9, y)).toBe('wall');
    }
  });

  it('seats each table with a chair on both sides', () => {
    for (const t of s.furniture.filter((f) => f.defId === 'table_small')) {
      const left = s.furniture.find(
        (f) => f.defId === 'chair_wood' && f.x === t.x - 1 && f.y === t.y,
      );
      const right = s.furniture.find(
        (f) => f.defId === 'chair_wood' && f.x === t.x + 1 && f.y === t.y,
      );
      expect(left).toBeDefined();
      expect(right).toBeDefined();
    }
  });
});
