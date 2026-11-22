import {
  FLOOR_STYLES,
  WALL_STYLES,
  type FloorStyleId,
  type WallSegmentId,
  type WallStyleId,
} from '../../data/surfaces';
import { SURFACE_CAP, SURFACE_FLOOR_RADIUS, SURFACE_WALL_RADIUS } from '../../data/happiness';
import { inBounds, tileAt, type GridState } from '../grid';
import type { GameState } from '../state';

export type PaintReason =
  | 'notNow'
  | 'unknownStyle'
  | 'locked'
  | 'notFloor'
  | 'unknownSegment'
  | 'noChange'
  | 'notEnoughMoney';
export type PaintResult =
  { ok: true; cost: number; changed: number } | { ok: false; reason: PaintReason };

export interface TilePoint {
  x: number;
  y: number;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Style a floor tile shows now: the painted one, else the default of its tile type. */
export function floorStyleAt(
  state: Pick<GameState, 'grid' | 'styles'>,
  x: number,
  y: number,
): FloorStyleId {
  const painted = state.styles.floor[key(x, y)];
  if (painted) return painted;
  return tileAt(state.grid, x, y) === 'floor_tile' ? 'checker' : 'wood';
}

export function wallStyleOf(state: Pick<GameState, 'styles'>, id: WallSegmentId): WallStyleId {
  return state.styles.wall[id] ?? 'cream';
}

/** Paints a tile; the default style is stored as "no override" so the map stays small. */
export function setFloorStyle(state: GameState, x: number, y: number, style: FloorStyleId): void {
  const tile = tileAt(state.grid, x, y) === 'floor_tile' ? 'checker' : 'wood';
  if (style === tile) delete state.styles.floor[key(x, y)];
  else state.styles.floor[key(x, y)] = style;
}

export function setWallStyle(state: GameState, id: WallSegmentId, style: WallStyleId): void {
  if (style === 'cream') delete state.styles.wall[id];
  else state.styles.wall[id] = style;
}

/** Back-wall segments of the room: the x = 0 wall (`l<y>`) and the y = 0 wall (`r<x>`). */
export function wallSegmentIds(grid: Pick<GridState, 'width' | 'height'>): WallSegmentId[] {
  const out: WallSegmentId[] = [];
  for (let y = 1; y < grid.height; y++) out.push(`l${y}`);
  for (let x = 1; x <= grid.width - 2; x++) out.push(`r${x}`);
  return out;
}

/** The room tile a wall segment stands next to. */
export function wallSegmentTile(id: WallSegmentId): TilePoint | null {
  const n = Number(id.slice(1));
  if (!Number.isInteger(n)) return null;
  if (id.startsWith('l')) return { x: 1, y: n };
  if (id.startsWith('r')) return { x: n, y: 1 };
  return null;
}

function isFloorTile(grid: GridState, x: number, y: number): boolean {
  const t = tileAt(grid, x, y);
  return t === 'floor_wood' || t === 'floor_tile';
}

function isWallSegment(grid: GridState, id: WallSegmentId): boolean {
  return wallSegmentIds(grid).includes(id);
}

/** Cost and refusal reasons of a paint stroke; a pure query the UI uses too. */
export function validatePaintFloor(
  state: GameState,
  tiles: readonly TilePoint[],
  style: FloorStyleId,
): PaintResult {
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  const def = FLOOR_STYLES[style] as (typeof FLOOR_STYLES)[FloorStyleId] | undefined;
  if (!def) return { ok: false, reason: 'unknownStyle' };
  if (state.rank < def.rank) return { ok: false, reason: 'locked' };
  const seen = new Set<string>();
  let changed = 0;
  for (const t of tiles) {
    if (!inBounds(state.grid, t.x, t.y) || !isFloorTile(state.grid, t.x, t.y)) {
      return { ok: false, reason: 'notFloor' };
    }
    const k = key(t.x, t.y);
    if (seen.has(k)) continue;
    seen.add(k);
    if (floorStyleAt(state, t.x, t.y) !== style) changed++;
  }
  return finishPaint(state, def.price, changed);
}

export function validatePaintWall(
  state: GameState,
  segments: readonly WallSegmentId[],
  style: WallStyleId,
): PaintResult {
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  const def = WALL_STYLES[style] as (typeof WALL_STYLES)[WallStyleId] | undefined;
  if (!def) return { ok: false, reason: 'unknownStyle' };
  if (state.rank < def.rank) return { ok: false, reason: 'locked' };
  const seen = new Set<string>();
  let changed = 0;
  for (const id of segments) {
    if (!isWallSegment(state.grid, id)) return { ok: false, reason: 'unknownSegment' };
    if (seen.has(id)) continue;
    seen.add(id);
    if (wallStyleOf(state, id) !== style) changed++;
  }
  return finishPaint(state, def.price, changed);
}

function finishPaint(state: GameState, price: number, changed: number): PaintResult {
  if (changed === 0) return { ok: false, reason: 'noChange' };
  const cost = changed * price;
  if (state.money < cost) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true, cost, changed };
}

/**
 * Appeal of the floors and walls around a chair (D-039): floor tiles within
 * SURFACE_FLOOR_RADIUS plus wall segments whose room tile is within SURFACE_WALL_RADIUS,
 * capped at SURFACE_CAP.
 */
export function surfacePoints(
  state: Pick<GameState, 'grid' | 'styles'>,
  chair: { x: number; y: number },
): number {
  let sum = 0;
  for (let y = chair.y - SURFACE_FLOOR_RADIUS; y <= chair.y + SURFACE_FLOOR_RADIUS; y++) {
    for (let x = chair.x - SURFACE_FLOOR_RADIUS; x <= chair.x + SURFACE_FLOOR_RADIUS; x++) {
      if (isFloorTile(state.grid as GridState, x, y))
        sum += FLOOR_STYLES[floorStyleAt(state, x, y)].appeal;
    }
  }
  for (const id of Object.keys(state.styles.wall)) {
    const t = wallSegmentTile(id);
    if (!t) continue;
    if (Math.max(Math.abs(t.x - chair.x), Math.abs(t.y - chair.y)) <= SURFACE_WALL_RADIUS) {
      sum += WALL_STYLES[wallStyleOf(state, id)].appeal;
    }
  }
  return Math.min(SURFACE_CAP, sum);
}
