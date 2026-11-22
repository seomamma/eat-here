/**
 * Room growth by rank (M12b, D-038). The room is an unlocked rectangle inside the allocated sim
 * grid; each rank-up from Rank 2 adds floor on up to three sides. The door never moves (front
 * edge), so the room never grows towards +y. New floor is plain wood.
 */
import { GRID_WIDTH, START_ROOM, type Room } from './layout';

export interface RoomGrowth {
  /** Columns added on the +x side (front-right edge). */
  plusX: number;
  /** Columns added on the -x side (back-left edge). */
  minusX: number;
  /** Rows added on the -y side (back-right edge). */
  minusY: number;
}

/** Growth gained on reaching the rank (key = rank). Ranks not listed add nothing. */
export const ROOM_GROWTH: Readonly<Record<number, RoomGrowth>> = {
  2: { plusX: 3, minusX: 0, minusY: 0 },
  3: { plusX: 0, minusX: 0, minusY: 3 },
  4: { plusX: 3, minusX: 0, minusY: 0 },
  5: { plusX: 0, minusX: 2, minusY: 2 },
  6: { plusX: 2, minusX: 0, minusY: 0 },
};

/** The sim grid keeps this many tiles free around the room (wall footprints at x0 - 1, y0 - 1, x1 + 1). */
export const ROOM_MARGIN = 1;

export function growthAtRank(rank: number): RoomGrowth | null {
  return ROOM_GROWTH[rank] ?? null;
}

/** Applies a growth to a room, clamped to the allocated grid (never shrinks). */
export function grownRoom(room: Readonly<Room>, g: RoomGrowth): Room {
  return {
    x0: Math.max(ROOM_MARGIN, room.x0 - g.minusX),
    y0: Math.max(ROOM_MARGIN, room.y0 - g.minusY),
    x1: Math.min(GRID_WIDTH - 1 - ROOM_MARGIN, room.x1 + g.plusX),
    y1: room.y1,
  };
}

/** The room as it is at a rank (the starting room plus every growth up to that rank). */
export function roomAtRank(rank: number): Room {
  let room: Room = { ...START_ROOM };
  for (let r = 2; r <= rank; r++) {
    const g = growthAtRank(r);
    if (g) room = grownRoom(room, g);
  }
  return room;
}

/** Largest room the allocated grid can hold with the schedule above. */
export const FINAL_ROOM: Readonly<Room> = roomAtRank(
  Math.max(...Object.keys(ROOM_GROWTH).map(Number)),
);
