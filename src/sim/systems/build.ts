import { FURNITURE, type FurnitureDefId, type Rot } from '../../data/furniture';
import { DOOR_X, DOOR_Y, WAITING_SPOTS } from '../../data/layout';
import { SHOP_ITEMS, unlockRank } from '../../data/shop';
import { isGuest, isStaff } from '../characters';
import {
  FACING_STEP,
  buildOccupancy,
  chairFacing,
  footprintTiles,
  inBounds,
  rotatedUseSpots,
  tileAt,
  type Furniture,
} from '../grid';
import { buildWalkGrid, isWalkable, type TilePos, type WalkGrid } from '../pathfinding';
import type { GameState } from '../state';

export type PlacementReason =
  'outOfBounds' | 'notFloor' | 'overlap' | 'blocksWay' | 'characterHere';
/** Pieces in use can be moved (M12b): characters are relocated or nudged by `relocateAfterMove`. */
export type BuyReason = PlacementReason | 'notNow' | 'notInShop' | 'locked' | 'notEnoughMoney';
export type MoveReason = PlacementReason | 'notNow' | 'unknownFurniture';

export type PlacementResult = { ok: true } | { ok: false; reason: PlacementReason };
export type BuyResult = { ok: true } | { ok: false; reason: BuyReason };
export type MoveResult = { ok: true } | { ok: false; reason: MoveReason };

const NEIGHBOURS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Tiles reachable from `from` over walkable tiles (4-directional flood fill). */
export function reachableFrom(walk: WalkGrid, from: TilePos): Set<number> {
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

/** True when a table stands on the tile a chair at (x, y) with this rotation faces. */
export function chairFacesTable(
  furniture: readonly Furniture[],
  x: number,
  y: number,
  rot: Rot,
): boolean {
  const step = FACING_STEP[chairFacing(rot)];
  const id = buildOccupancy(furniture).get(`${x + step.x},${y + step.y}`);
  const f = id ? furniture.find((o) => o.id === id) : undefined;
  return f !== undefined && FURNITURE[f.defId].kind === 'table';
}

/** Guests only pick chairs that face a table (a table next to the chair, in its direction). */
export function isChairUsable(state: Pick<GameState, 'furniture'>, chair: Furniture): boolean {
  return chairFacesTable(state.furniture, chair.x, chair.y, chair.rot);
}

/**
 * Default rotation of a chair newly put at (x, y): faces an adjacent table if there is one
 * (first match in rotation order), else rot 0.
 */
export function autoFaceRot(furniture: readonly Furniture[], x: number, y: number): Rot {
  for (const rot of [0, 1, 2, 3] as const) {
    if (chairFacesTable(furniture, x, y, rot)) return rot;
  }
  return 0;
}

/** Tiles characters occupy: current tile(s) (both when between two) and the one being entered. */
function characterTiles(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const c of state.characters) {
    for (const x of new Set([Math.floor(c.x), Math.ceil(c.x)])) {
      for (const y of new Set([Math.floor(c.y), Math.ceil(c.y)])) out.add(`${x},${y}`);
    }
    const next = c.path[0];
    if (next) out.add(`${next.x},${next.y}`);
  }
  return out;
}

/**
 * A piece that cannot be sold right now: a chair claimed by a guest, a table a seated guest
 * faces, the oven while a chef works at it, a pass with reserved dishes or staff using it.
 * Moving such a piece is allowed (`relocateAfterMove` carries the users along).
 */
export function isInUse(state: GameState, f: Furniture): boolean {
  const guests = state.characters.filter(isGuest);
  const staff = state.characters.filter(isStaff);
  switch (FURNITURE[f.defId].kind) {
    case 'chair':
      return guests.some((g) => g.seatId === f.id);
    case 'table': {
      const mine = new Set(footprintTiles(f.defId, f.x, f.y, f.rot).map((t) => `${t.x},${t.y}`));
      return guests.some((g) => {
        const chair = g.seatId ? state.furniture.find((o) => o.id === g.seatId) : undefined;
        if (!chair) return false;
        const step = FACING_STEP[chairFacing(chair.rot)];
        return mine.has(`${chair.x + step.x},${chair.y + step.y}`);
      });
    }
    case 'oven':
      return staff.some((s) => s.stage === 'goOven' || s.stage === 'bake');
    case 'vending':
    case 'toilet':
      return guests.some((g) => g.errand?.furnitureId === f.id);
    case 'pass':
      return (
        state.orders.some((o) => o.slot !== null) ||
        staff.some((s) => s.stage === 'goPass' || s.stage === 'place' || s.stage === 'pickUp')
      );
    default:
      return false;
  }
}

/** Every tile that must stay reachable from the door, given the furniture layout. */
export function reachabilityOk(state: GameState, furniture: readonly Furniture[]): boolean {
  const walk = buildWalkGrid(state.grid, furniture);
  const reached = reachableFrom(walk, { x: DOOR_X, y: DOOR_Y });
  const ok = (t: TilePos) => reached.has(t.y * walk.width + t.x);
  for (const f of furniture) {
    const kind = FURNITURE[f.defId].kind;
    if (kind === 'oven' || kind === 'pass' || kind === 'vending' || kind === 'toilet') {
      for (const s of rotatedUseSpots(f.defId, f.rot)) {
        if (!ok({ x: f.x + s.dx, y: f.y + s.dy })) return false;
      }
    } else if (kind === 'chair') {
      // The chair itself is blocked; guests walk to a free tile next to it.
      if (!NEIGHBOURS.some(([dx, dy]) => ok({ x: f.x + dx, y: f.y + dy }))) return false;
    }
  }
  for (const c of state.characters) if (isStaff(c) && !ok(c.home)) return false;
  // Nobody may be walled in: every walkable tile a character stands on stays connected.
  for (const key of characterTiles(state)) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (isWalkable(walk, x, y) && !ok({ x, y })) return false;
  }
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
  /** Moving: characters on the footprint are nudged aside instead of refusing the placement. */
  allowCharacters = false,
): PlacementResult {
  const others = state.furniture.filter((f) => f.id !== ignoreFurnitureId);
  const occupied = buildOccupancy(others);
  const tiles = footprintTiles(defId, x, y, rot);
  if (tiles.some((t) => !inBounds(state.grid, t.x, t.y)))
    return { ok: false, reason: 'outOfBounds' };
  for (const t of tiles) {
    const type = tileAt(state.grid, t.x, t.y);
    if (type === 'door') return { ok: false, reason: 'blocksWay' };
    // Guests step in from the door onto the tile in front of it: it stays free.
    if (t.x === DOOR_X && t.y === DOOR_Y - 1) return { ok: false, reason: 'blocksWay' };
    if (type !== 'floor_wood' && type !== 'floor_tile') return { ok: false, reason: 'notFloor' };
  }
  if (tiles.some((t) => occupied.has(`${t.x},${t.y}`))) return { ok: false, reason: 'overlap' };
  if (!allowCharacters) {
    const standing = characterTiles(state);
    if (tiles.some((t) => standing.has(`${t.x},${t.y}`))) {
      return { ok: false, reason: 'characterHere' };
    }
  }
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
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  if (!SHOP_ITEMS.includes(defId)) return { ok: false, reason: 'notInShop' };
  if (state.rank < unlockRank(defId)) return { ok: false, reason: 'locked' };
  if (state.money < FURNITURE[defId].price) return { ok: false, reason: 'notEnoughMoney' };
  return validatePlacement(state, defId, x, y, rot);
}

/** Everything `moveFurniture` checks (phase, placement); a pure query for the UI. */
export function validateMove(
  state: GameState,
  id: string,
  x: number,
  y: number,
  rot: Rot,
): MoveResult {
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  const piece = state.furniture.find((f) => f.id === id);
  if (!piece) return { ok: false, reason: 'unknownFurniture' };
  return validatePlacement(state, piece.defId, x, y, rot, id, true);
}

/** Valid tile closest to the room centre for a new piece (rot 0), or null when none fits. */
export function findFreeSpot(state: GameState, defId: FurnitureDefId): TilePos | null {
  const { room } = state;
  const cx = (room.x0 + room.x1) / 2;
  const cy = (room.y0 + room.y1) / 2;
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = room.y0; y <= room.y1; y++) {
    for (let x = room.x0; x <= room.x1; x++) {
      candidates.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
    }
  }
  candidates.sort((a, b) => a.d - b.d); // stable: ties keep row-major order
  for (const c of candidates) {
    if (validatePlacement(state, defId, c.x, c.y, 0).ok) return { x: c.x, y: c.y };
  }
  return null;
}
