import type { FurnitureDefId, Rot } from './furniture';
import type { StaffRole } from './staff';

/** `outside` = not part of the room (yet): neither walkable nor buildable. Walls are derived from the room rectangle. */
export type TileType = 'floor_wood' | 'floor_tile' | 'door' | 'outside';

/**
 * The sim grid is allocated at its final size (M12b, D-038); the room is an unlocked rectangle
 * inside it that grows with rank (`src/data/expansion.ts`). The door stays on the front edge
 * (y = DOOR_Y), so the room only grows towards +x, -x and -y.
 */
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 17;

/** Unlocked floor rectangle, inclusive on all four sides. */
export interface Room {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Where the pre-M12b 10x12 grid (room tiles 1..8 x 1..11) sits inside the allocated grid:
 * leaves room to grow 2 columns towards -x and 5 rows towards -y.
 */
export const LEGACY_OFFSET = { x: 2, y: 5 } as const;

/** Local (pre-M12b) coordinates to grid coordinates. */
const local = (x: number, y: number) => ({ x: x + LEGACY_OFFSET.x, y: y + LEGACY_OFFSET.y });

/** The room a new game starts with (the old 8 x 11 interior). */
export const START_ROOM: Readonly<Room> = {
  x0: 1 + LEGACY_OFFSET.x,
  y0: 1 + LEGACY_OFFSET.y,
  x1: 8 + LEGACY_OFFSET.x,
  y1: 11 + LEGACY_OFFSET.y,
};

/** Rows y0..y0 + KITCHEN_ROWS - 1 of the starting room (below the back wall) have checker tile floor. */
export const KITCHEN_ROWS = 3;
/** Door tile on the room's front edge. It never moves. */
export const DOOR_X = local(4, 0).x;
export const DOOR_Y = START_ROOM.y1;

export interface LayoutFurniture {
  defId: FurnitureDefId;
  x: number;
  y: number;
  rot?: Rot;
}

/** Starting restaurant: oven + pass in the kitchen, 2 tables with 2 chairs each (chairs face their table). */
export const START_FURNITURE: readonly LayoutFurniture[] = [
  { defId: 'oven_pizza', ...local(2, 1) },
  { defId: 'counter_pass', ...local(5, 3) },
  { defId: 'table_small', ...local(3, 6) },
  { defId: 'chair_wood', ...local(2, 6), rot: 1 },
  { defId: 'chair_wood', ...local(4, 6), rot: 3 },
  { defId: 'table_small', ...local(6, 8) },
  { defId: 'chair_wood', ...local(5, 8), rot: 1 },
  { defId: 'chair_wood', ...local(7, 8), rot: 3 },
];

/** Starting staff and their idle spots: chef in the kitchen, waiter near the pass (waiter side). */
export const START_STAFF: readonly { role: StaffRole; x: number; y: number }[] = [
  { role: 'chef', ...local(4, 2) },
  { role: 'waiter', ...local(6, 4) },
];

/** Tile type of the starting grid: the starting room (kitchen checker, door) inside 'outside'. */
export function startTile(x: number, y: number): TileType {
  const r = START_ROOM;
  if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) return 'outside';
  if (y === DOOR_Y && x === DOOR_X) return 'door';
  return y < r.y0 + KITCHEN_ROWS ? 'floor_tile' : 'floor_wood';
}

/** Spots near the door where guests without a seat wait (guests may overlap). */
export const WAITING_SPOTS: readonly { x: number; y: number }[] = [
  { x: DOOR_X - 1, y: DOOR_Y - 1 },
  { x: DOOR_X + 1, y: DOOR_Y - 1 },
  { x: DOOR_X - 2, y: DOOR_Y - 1 },
  { x: DOOR_X + 2, y: DOOR_Y - 1 },
];
