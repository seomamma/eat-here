import { describe, expect, it } from 'vitest';
import { FURNITURE } from '../../src/data/furniture';
import { buildOccupancy, canPlace, furnitureAt, footprintTiles, tileAt } from '../../src/sim/grid';
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
      for (const t of footprintTiles(f.defId, f.x, f.y)) {
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
