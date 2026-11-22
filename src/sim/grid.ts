import {
  FURNITURE,
  type Facing,
  type FurnitureDefId,
  type Rot,
  type UseSpot,
} from '../data/furniture';
import { GRID_HEIGHT, GRID_WIDTH, START_FURNITURE, startTile, type TileType } from '../data/layout';

export type { TileType };

export interface GridState {
  width: number;
  height: number;
  /** Row-major, length width * height. */
  tiles: TileType[];
}

export interface Furniture {
  id: string;
  defId: FurnitureDefId;
  x: number;
  y: number;
  rot: Rot;
  level: number;
}

export function createGrid(): GridState {
  const tiles: TileType[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) tiles.push(startTile(x, y));
  }
  return { width: GRID_WIDTH, height: GRID_HEIGHT, tiles };
}

export function createStartFurniture(): Furniture[] {
  return START_FURNITURE.map((f, i) => ({
    id: `f${i + 1}`,
    defId: f.defId,
    x: f.x,
    y: f.y,
    rot: f.rot ?? 0,
    level: 1,
  }));
}

export function inBounds(grid: { width: number; height: number }, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < grid.width &&
    y < grid.height
  );
}

export function tileAt(grid: GridState, x: number, y: number): TileType | undefined {
  return inBounds(grid, x, y) ? grid.tiles[y * grid.width + x] : undefined;
}

/** Rot 1 mirrors the piece across the x = y diagonal, so axes swap. */
const MIRRORED_FACING: Record<Facing, Facing> = {
  up: 'left',
  left: 'up',
  down: 'right',
  right: 'down',
};

/** Footprint [width, height] after rotation (swapped for rot 1). */
export function rotatedFootprint(defId: FurnitureDefId, rot: Rot = 0): readonly [number, number] {
  const [w, h] = FURNITURE[defId].footprint;
  return rot === 1 ? [h, w] : [w, h];
}

/** Use spots (relative to the furniture origin) after rotation. */
export function rotatedUseSpots(defId: FurnitureDefId, rot: Rot = 0): UseSpot[] {
  return FURNITURE[defId].useSpots.map((s) =>
    rot === 1 ? { dx: s.dy, dy: s.dx, facing: MIRRORED_FACING[s.facing] } : { ...s },
  );
}

/** Tiles covered by a footprint placed at (x, y) with the given rotation. */
export function footprintTiles(
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: Rot = 0,
): { x: number; y: number }[] {
  const [w, h] = rotatedFootprint(defId, rot);
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

/** Map of "x,y" -> furniture id for every occupied tile. */
export function buildOccupancy(furniture: readonly Furniture[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of furniture) {
    for (const t of footprintTiles(f.defId, f.x, f.y, f.rot)) map.set(`${t.x},${t.y}`, f.id);
  }
  return map;
}

/** Furniture id occupying the tile, or undefined if free. */
export function furnitureAt(
  state: { furniture: readonly Furniture[] },
  x: number,
  y: number,
): string | undefined {
  for (const f of state.furniture) {
    for (const t of footprintTiles(f.defId, f.x, f.y, f.rot)) {
      if (t.x === x && t.y === y) return f.id;
    }
  }
  return undefined;
}

function isFloor(t: TileType | undefined): boolean {
  return t === 'floor_wood' || t === 'floor_tile';
}

/** Bounds, floor and free-footprint check. Reachability is added in M7. */
export function canPlace(
  state: { grid: GridState; furniture: readonly Furniture[] },
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: Rot = 0,
): boolean {
  const occupied = buildOccupancy(state.furniture);
  return footprintTiles(defId, x, y, rot).every(
    (t) => isFloor(tileAt(state.grid, t.x, t.y)) && !occupied.has(`${t.x},${t.y}`),
  );
}
