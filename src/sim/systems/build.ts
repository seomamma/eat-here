import { FURNITURE, type FurnitureDefId, type Rot } from '../../data/furniture';
import { DOOR_X, WAITING_SPOTS } from '../../data/layout';
import { SHOP_ITEMS } from '../../data/shop';
import { isStaff } from '../characters';
import {
  buildOccupancy,
  footprintTiles,
  inBounds,
  rotatedUseSpots,
  tileAt,
  type Furniture,
} from '../grid';
import { buildWalkGrid, isWalkable, type TilePos, type WalkGrid } from '../pathfinding';
import type { GameState } from '../state';

export type PlacementReason = 'outOfBounds' | 'notFloor' | 'overlap' | 'blocksWay';
export type BuyReason = PlacementReason | 'notPrep' | 'notInShop' | 'notEnoughMoney';

export type PlacementResult = { ok: true } | { ok: false; reason: PlacementReason };
export type BuyResult = { ok: true } | { ok: false; reason: BuyReason };

const NEIGHBOURS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Tiles reachable from `from` over walkable tiles (4-directional flood fill). */
function reachableFrom(walk: WalkGrid, from: TilePos): Set<number> {
  const seen = new Set<number>();
  if (!isWalkable(walk, from.x, from.y)) return seen;
  const queue = [from.y * walk.width + from.x];
  seen.add(queue[0] as number);
  for (let i = 0; i < queue.length; i++) {
    const idx = queue[i] as number;
    const x = idx % walk.width;
    const y = Math.floor(idx / walk.width);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(walk, nx, ny)) continue;
      const n = ny * walk.width + nx;
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

/** True when a table stands next to tile (x, y): a chair there can be used by guests. */
export function hasAdjacentTable(furniture: readonly Furniture[], x: number, y: number): boolean {
  const occupancy = buildOccupancy(furniture);
  return NEIGHBOURS.some(([dx, dy]) => {
    const id = occupancy.get(`${x + dx},${y + dy}`);
    const f = id ? furniture.find((o) => o.id === id) : undefined;
    return f !== undefined && FURNITURE[f.defId].kind === 'table';
  });
}

/** Guests only pick chairs with an adjacent table. */
export function isChairUsable(state: Pick<GameState, 'furniture'>, chair: Furniture): boolean {
  return hasAdjacentTable(state.furniture, chair.x, chair.y);
}

/** Every tile that must stay reachable from the door, given the furniture layout. */
function reachabilityOk(state: GameState, furniture: readonly Furniture[]): boolean {
  const walk = buildWalkGrid(state.grid, furniture);
  const reached = reachableFrom(walk, { x: DOOR_X, y: state.grid.height - 1 });
  const ok = (t: TilePos) => reached.has(t.y * walk.width + t.x);
  for (const f of furniture) {
    const kind = FURNITURE[f.defId].kind;
    if (kind === 'oven' || kind === 'pass') {
      for (const s of rotatedUseSpots(f.defId, f.rot)) {
        if (!ok({ x: f.x + s.dx, y: f.y + s.dy })) return false;
      }
    } else if (kind === 'chair') {
      // The chair itself is blocked; guests walk to a free tile next to it.
      if (!NEIGHBOURS.some(([dx, dy]) => ok({ x: f.x + dx, y: f.y + dy }))) return false;
    }
  }
  for (const c of state.characters) if (isStaff(c) && !ok(c.home)) return false;
  return WAITING_SPOTS.every(ok);
}

/**
 * Footprint on free floor and every station, seat, idle spot and waiting spot still reachable
 * from the door. `ignoreFurnitureId` is the piece being moved (its old position is free).
 */
export function validatePlacement(
  state: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: Rot,
  ignoreFurnitureId?: string,
): PlacementResult {
  const others = state.furniture.filter((f) => f.id !== ignoreFurnitureId);
  const occupied = buildOccupancy(others);
  const tiles = footprintTiles(defId, x, y, rot);
  if (tiles.some((t) => !inBounds(state.grid, t.x, t.y)))
    return { ok: false, reason: 'outOfBounds' };
  for (const t of tiles) {
    const type = tileAt(state.grid, t.x, t.y);
    if (type === 'door') return { ok: false, reason: 'blocksWay' };
    if (type !== 'floor_wood' && type !== 'floor_tile') return { ok: false, reason: 'notFloor' };
  }
  if (tiles.some((t) => occupied.has(`${t.x},${t.y}`))) return { ok: false, reason: 'overlap' };
  const piece: Furniture = { id: '__placing', defId, x, y, rot, level: 1 };
  if (!reachabilityOk(state, [...others, piece])) return { ok: false, reason: 'blocksWay' };
  return { ok: true };
}

/** Everything `buyAndPlace` checks (shop list, money, placement); a pure query for the UI. */
export function validateBuy(
  state: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: Rot,
): BuyResult {
  if (state.clock.phase !== 'prep') return { ok: false, reason: 'notPrep' };
  if (!SHOP_ITEMS.includes(defId)) return { ok: false, reason: 'notInShop' };
  if (state.money < FURNITURE[defId].price) return { ok: false, reason: 'notEnoughMoney' };
  return validatePlacement(state, defId, x, y, rot);
}

/** Valid tile closest to the room centre for a new piece (rot 0), or null when none fits. */
export function findFreeSpot(state: GameState, defId: FurnitureDefId): TilePos | null {
  const cx = (state.grid.width - 1) / 2;
  const cy = (state.grid.height - 1) / 2;
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < state.grid.height; y++) {
    for (let x = 0; x < state.grid.width; x++) {
      candidates.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
    }
  }
  candidates.sort((a, b) => a.d - b.d); // stable: ties keep row-major order
  for (const c of candidates) {
    if (validatePlacement(state, defId, c.x, c.y, 0).ok) return { x: c.x, y: c.y };
  }
  return null;
}
