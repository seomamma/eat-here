import { grownRoom, type RoomGrowth } from '../../data/expansion';
import type { GridState, Room } from '../grid';

/**
 * Grows the unlocked room by `growth` (clamped to the allocated grid) and turns the new tiles
 * into plain wood floor. Nothing moves or shrinks: existing tiles, furniture, styles and
 * characters keep their coordinates, and the door row stays where it is. Returns what was
 * actually added.
 */
export function expandRoom(state: { room: Room; grid: GridState }, growth: RoomGrowth): RoomGrowth {
  const before = state.room;
  const after = grownRoom(before, growth);
  const { grid } = state;
  for (let y = after.y0; y <= after.y1; y++) {
    for (let x = after.x0; x <= after.x1; x++) {
      const i = y * grid.width + x;
      if (grid.tiles[i] === 'outside') grid.tiles[i] = 'floor_wood';
    }
  }
  state.room = after;
  return {
    plusX: after.x1 - before.x1,
    minusX: before.x0 - after.x0,
    minusY: before.y0 - after.y0,
  };
}

/** Tiles of `after` that are not in `before` (the freshly unlocked floor). */
export function addedTiles(
  before: Readonly<Room>,
  after: Readonly<Room>,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = after.y0; y <= after.y1; y++) {
    for (let x = after.x0; x <= after.x1; x++) {
      if (x < before.x0 || x > before.x1 || y < before.y0 || y > before.y1) out.push({ x, y });
    }
  }
  return out;
}
