import { describe, expect, it } from 'vitest';
import { DOOR_X, GRID_HEIGHT, GRID_WIDTH } from '../../src/data/layout';
import { SURROUNDING_PROPS, groundKind, groundRect, isRoomTile } from '../../src/data/surroundings';

describe('surroundings data', () => {
  it('draws no ground inside the room and ground right outside it', () => {
    for (let y = 1; y < GRID_HEIGHT; y++)
      for (let x = 1; x < GRID_WIDTH - 1; x++) expect(groundKind(x, y)).toBeNull();
    expect(groundKind(0, 5)).toBe('soil');
    expect(groundKind(-4, 5)).toBe('grass');
    expect(groundKind(5, 0)).toBe('soil');
  });

  it('has a sidewalk, then a street with a dashed centre line, then grass on the door side', () => {
    expect(groundKind(DOOR_X, GRID_HEIGHT)).toBe('sidewalk');
    expect(groundKind(DOOR_X, GRID_HEIGHT + 1)).toBe('asphalt');
    expect(groundKind(DOOR_X, GRID_HEIGHT + 2)).toBe('asphalt_line');
    expect(groundKind(DOOR_X, GRID_HEIGHT + 3)).toBe('asphalt');
    expect(groundKind(DOOR_X, GRID_HEIGHT + 4)).toBe('grass');
  });

  it('keeps every prop outside the room, on ground, and the door gap clear', () => {
    const { x0, x1, y0, y1 } = groundRect();
    for (const p of SURROUNDING_PROPS) {
      expect(isRoomTile(p.x, p.y), `${p.kind} at ${p.x},${p.y}`).toBe(false);
      expect(groundKind(p.x, p.y), `${p.kind} at ${p.x},${p.y}`).not.toBeNull();
      expect(p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).toBe(true);
      const width = p.kind === 'bench' ? 2 : 1;
      if (p.y === GRID_HEIGHT) {
        expect(p.x <= DOOR_X && DOOR_X < p.x + width).toBe(false);
      }
    }
  });
});
