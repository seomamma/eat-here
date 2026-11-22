import { describe, expect, it } from 'vitest';
import { roomAtRank } from '../../src/data/expansion';
import { DOOR_X, DOOR_Y, START_ROOM } from '../../src/data/layout';
import { groundKind, groundRect, isRoomTile, surroundingProps } from '../../src/data/surroundings';

const ROOMS = [1, 2, 3, 4, 5, 6].map((rank) => ({ rank, room: roomAtRank(rank) }));

describe('surroundings data', () => {
  it('draws no ground inside the room and ground right outside it', () => {
    for (const { room } of ROOMS) {
      for (let y = room.y0; y <= room.y1; y++)
        for (let x = room.x0; x <= room.x1; x++) expect(groundKind(room, x, y)).toBeNull();
      expect(groundKind(room, room.x0 - 1, room.y0 + 4)).toBe('soil');
      expect(groundKind(room, room.x0 - 5, room.y0 + 4)).toBe('grass');
      expect(groundKind(room, room.x0 + 3, room.y0 - 1)).toBe('soil');
      expect(groundKind(room, room.x1 + 1, room.y0 + 3)).toBe('soil');
    }
  });

  it('has a sidewalk, then a street with a dashed centre line, then grass on the door side', () => {
    for (const { room } of ROOMS) {
      expect(groundKind(room, DOOR_X, DOOR_Y + 1)).toBe('sidewalk');
      expect(groundKind(room, DOOR_X, DOOR_Y + 2)).toBe('asphalt');
      expect(groundKind(room, DOOR_X, DOOR_Y + 3)).toBe('asphalt_line');
      expect(groundKind(room, DOOR_X, DOOR_Y + 4)).toBe('asphalt');
      expect(groundKind(room, DOOR_X, DOOR_Y + 5)).toBe('grass');
    }
  });

  it('keeps the street and sidewalk in front of the door edge as the room grows', () => {
    for (const { room } of ROOMS) {
      const { x0, x1 } = groundRect(room);
      expect(room.y1).toBe(START_ROOM.y1);
      for (let x = room.x0; x <= room.x1; x++)
        expect(groundKind(room, x, room.y1 + 1)).toBe('sidewalk');
      expect(x0).toBeLessThan(room.x0);
      expect(x1).toBeGreaterThan(room.x1);
    }
  });

  it('keeps every prop outside the room, on ground, trees off the walls, and the door gap clear', () => {
    for (const { rank, room } of ROOMS) {
      const { x0, x1, y0, y1 } = groundRect(room);
      const props = surroundingProps(room);
      expect(props.length, `rank ${rank}`).toBeGreaterThan(10);
      const trees = props.filter((p) => p.kind.startsWith('tree'));
      expect(trees.length, `rank ${rank} trees`).toBeGreaterThan(1);
      for (const p of props) {
        const at = `rank ${rank}: ${p.kind} at ${p.x},${p.y}`;
        expect(isRoomTile(room, p.x, p.y), at).toBe(false);
        expect(groundKind(room, p.x, p.y), at).not.toBeNull();
        expect(p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1, at).toBe(true);
        const width = p.kind === 'bench' ? 2 : 1;
        if (p.y === DOOR_Y + 1) expect(p.x <= DOOR_X && DOOR_X < p.x + width, at).toBe(false);
        if (p.kind.startsWith('tree') && p.y <= room.y1) {
          const gap = Math.max(room.x0 - p.x, p.x - room.x1, room.y0 - p.y);
          expect(gap, at).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('is deterministic and keeps the props of ring tiles that stay outside when the room grows', () => {
    const a = roomAtRank(1);
    const b = roomAtRank(2);
    expect(surroundingProps(a)).toEqual(surroundingProps(a));
    const before = surroundingProps(a);
    const after = new Set(surroundingProps(b).map((p) => `${p.kind}@${p.x},${p.y}`));
    // Far away from the grown edge (the back-left side) nothing moved.
    const far = before.filter((p) => p.x < a.x0 - 1 && p.kind.startsWith('tree'));
    expect(far.length).toBeGreaterThan(0);
    for (const p of far) expect(after.has(`${p.kind}@${p.x},${p.y}`)).toBe(true);
  });
});
