import type { FurnitureDefId, Rot } from './furniture';
import type { StaffRole } from './staff';

export type TileType = 'floor_wood' | 'floor_tile' | 'wall' | 'door';

export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 12;

/** Rows 1..KITCHEN_ROWS (below the back wall) have checker tile floor. */
export const KITCHEN_ROWS = 3;
/** Door tile in the bottom row. */
export const DOOR_X = 4;

export interface LayoutFurniture {
  defId: FurnitureDefId;
  x: number;
  y: number;
  rot?: Rot;
}

/** Starting restaurant: oven + pass in the kitchen, 2 tables with 2 chairs each. */
export const START_FURNITURE: readonly LayoutFurniture[] = [
  { defId: 'oven_pizza', x: 2, y: 1 },
  { defId: 'counter_pass', x: 5, y: 3 },
  { defId: 'table_small', x: 3, y: 6 },
  { defId: 'chair_wood', x: 2, y: 6 },
  { defId: 'chair_wood', x: 4, y: 6, rot: 1 },
  { defId: 'table_small', x: 6, y: 8 },
  { defId: 'chair_wood', x: 5, y: 8 },
  { defId: 'chair_wood', x: 7, y: 8, rot: 1 },
];

/** Starting staff and their idle spots: chef in the kitchen, waiter near the pass (waiter side). */
export const START_STAFF: readonly { role: StaffRole; x: number; y: number }[] = [
  { role: 'chef', x: 4, y: 2 },
  { role: 'waiter', x: 6, y: 4 },
];

export function startTile(x: number, y: number): TileType {
  if (y === 0 || x === 0 || x === GRID_WIDTH - 1) return 'wall';
  if (y === GRID_HEIGHT - 1 && x === DOOR_X) return 'door';
  return y <= KITCHEN_ROWS ? 'floor_tile' : 'floor_wood';
}

/** Spots near the door where guests without a seat wait (guests may overlap). */
export const WAITING_SPOTS: readonly { x: number; y: number }[] = [
  { x: 3, y: 10 },
  { x: 5, y: 10 },
  { x: 2, y: 10 },
  { x: 6, y: 10 },
];
