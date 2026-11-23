import { FURNITURE } from '../../data/furniture';
import { GUEST_TYPES } from '../../data/guests';
import { DOOR_X, DOOR_Y } from '../../data/layout';
import {
  FACING_DIR,
  isGuest,
  isStaff,
  type Character,
  type Guest,
  type Staff,
} from '../characters';
import { footprintTiles, rotatedUseSpots, type Furniture } from '../grid';
import { findPath, isWalkable, type TilePos } from '../pathfinding';
import { reachableFrom } from './build';
import { seatFacing, type GuestContext } from './guests';
import { getJob, resetStaff, stationSpot } from './jobs';
import { secToTicks } from './spawner';
import { beginStage } from './staff';
import { splitRun } from '../street';

/**
 * Carries everyone along when a piece in use is moved or turned (M12b). Runs right after the
 * piece got its new position, with the walk grid already rebuilt:
 * - a guest seated on a moved chair moves with it (same claim, same phase, faces the new way);
 * - the chef baking / staff using the pass are put on the station's new use spot;
 * - a guest using a toilet or vending machine is put on its new use spot (a walker re-plans);
 * - anyone standing on the new footprint is nudged to the nearest reachable free tile and
 *   re-plans towards the goal it had;
 * - every staff member walking to a station re-plans to where the station is now.
 * Nobody ends up inside furniture or on a tile cut off from the door.
 */
export function relocateAfterMove(
  ctx: GuestContext,
  piece: Furniture,
  from: { x: number; y: number; rot: number },
): void {
  const { state } = ctx;
  const kind = FURNITURE[piece.defId].kind;
  const carried = new Set<string>();

  for (const c of state.characters) {
    if (isGuest(c)) {
      if (kind === 'chair' && c.seatId === piece.id && relocateSeated(ctx, c, piece, from)) {
        carried.add(c.id);
      } else if (c.errand?.furnitureId === piece.id) {
        relocateErrand(ctx, c, piece);
        carried.add(c.id);
      }
    } else if (isStaff(c) && c.phase === 'working') {
      if (kind === 'oven' && c.stage === 'bake') {
        putOnSpot(c, stationSpot(state, 'oven', 0));
        carried.add(c.id);
      } else if (kind === 'pass' && (c.stage === 'place' || c.stage === 'pickUp')) {
        putOnSpot(c, stationSpot(state, 'pass', c.stage === 'place' ? 0 : 1));
        carried.add(c.id);
      }
    }
  }

  const covered = new Set(
    footprintTiles(piece.defId, piece.x, piece.y, piece.rot).map((t) => `${t.x},${t.y}`),
  );
  const reached = reachableFrom(ctx.walk, { x: DOOR_X, y: DOOR_Y });
  for (const c of state.characters) {
    if (!carried.has(c.id) && standsOn(c, covered)) nudge(ctx, c, reached);
  }

  // Staff on their way to a station or guest: the target may have moved.
  for (const c of state.characters) {
    if (!isStaff(c) || c.phase !== 'walkingToJob') continue;
    const job = c.jobId ? getJob(state, c.jobId) : undefined;
    if (job && beginStage(ctx, c, job)) continue;
    if (job) job.assigneeId = null;
    resetStaff(c);
  }
}

function tileOf(c: Character): TilePos {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}

/** Tiles a character occupies: those it lies between and the one it is entering. */
function standsOn(c: Character, tiles: ReadonlySet<string>): boolean {
  for (const x of new Set([Math.floor(c.x), Math.ceil(c.x)])) {
    for (const y of new Set([Math.floor(c.y), Math.ceil(c.y)])) {
      if (tiles.has(`${x},${y}`)) return true;
    }
  }
  const next = c.path[0];
  return next !== undefined && tiles.has(`${next.x},${next.y}`);
}

function place(c: Character, tile: TilePos): void {
  c.x = c.prevX = tile.x;
  c.y = c.prevY = tile.y;
}

function putOnSpot(s: Staff, spot: { tile: TilePos; dir: Staff['dir'] } | null): void {
  if (!spot) return;
  place(s, spot.tile);
  s.path = [];
  s.target = spot.tile;
  s.dir = spot.dir;
}

/** The guest sits on the moved chair: it moves with it. A walker to the chair re-plans. */
function relocateSeated(
  ctx: GuestContext,
  g: Guest,
  chair: Furniture,
  from: { x: number; y: number },
): boolean {
  const atOld = g.path.length === 0 && tileOf(g).x === from.x && tileOf(g).y === from.y;
  if (atOld) {
    place(g, { x: chair.x, y: chair.y });
    g.dir = seatFacing(chair);
    return true;
  }
  if (g.phase === 'walkingToSeat') {
    const start = g.path[0] ?? tileOf(g);
    const path = findPath(
      ctx.walk,
      start,
      { x: chair.x, y: chair.y },
      { allowGoalBlocked: true, allowStartBlocked: true },
    );
    if (path) {
      g.path = path;
    } else {
      // No way to the moved chair: give the seat back and wait for another one.
      g.seatId = null;
      g.phase = 'waitingForSeat';
      g.waitSpot = null;
      g.path = g.path.slice(0, 1);
      g.timer = secToTicks(GUEST_TYPES[g.typeId].seatPatienceSec);
    }
    return true;
  }
  return false; // standing up or leaving: an ordinary walker
}

/** A guest using (or walking to) a toilet or vending machine follows it to its new spot. */
function relocateErrand(ctx: GuestContext, g: Guest, f: Furniture): void {
  const e = g.errand;
  const spot = rotatedUseSpots(f.defId, f.rot)[0];
  if (!e || !spot) return;
  const tile = { x: f.x + spot.dx, y: f.y + spot.dy };
  if (e.stage === 'using') {
    place(g, tile);
    g.path = [];
    g.dir = FACING_DIR[spot.facing];
    return;
  }
  const start = g.path[0] ?? tileOf(g);
  const path = findPath(ctx.walk, start, tile, { allowStartBlocked: true });
  if (path) g.path = path;
  else {
    g.errand = null; // cannot get there any more: the visit is skipped
    g.path = g.path.slice(0, 1);
  }
}

/** Moves a character off the new footprint to the nearest reachable tile and re-plans its walk. */
function nudge(ctx: GuestContext, c: Character, reached: ReadonlySet<number>): void {
  const { walk } = ctx;
  const here = { x: c.x, y: c.y };
  // A walk along the sidewalk keeps its street part; only the run inside the room is re-planned.
  const { run, tail } = splitRun(c.path);
  const goal = run[run.length - 1];
  let best: { tile: TilePos; d: number } | null = null;
  for (const idx of reached) {
    const x = idx % walk.width;
    const y = Math.floor(idx / walk.width);
    const d = Math.abs(x - here.x) + Math.abs(y - here.y);
    if (
      !best ||
      d < best.d ||
      (d === best.d && (y < best.tile.y || (y === best.tile.y && x < best.tile.x)))
    )
      best = { tile: { x, y }, d };
  }
  if (!best) return;
  place(c, best.tile);
  c.path = [];
  if (!goal) return;
  const path = findPath(walk, best.tile, goal, {
    allowGoalBlocked: !isWalkable(walk, goal.x, goal.y),
  });
  if (path) {
    c.path = [...path, ...tail];
    return;
  }
  if (isGuest(c) && c.phase === 'walkingToSeat') {
    c.seatId = null;
    c.phase = 'waitingForSeat';
    c.waitSpot = null;
    c.timer = secToTicks(GUEST_TYPES[c.typeId].seatPatienceSec);
  }
}
