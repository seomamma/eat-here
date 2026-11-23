import { isGuest, isStaff, type Character, type Guest, type Staff } from '../characters';
import { findPath, isWalkable, type TilePos } from '../pathfinding';
import { secToTicks } from './spawner';
import { GUEST_TYPES } from '../../data/guests';
import { getJob, resetStaff } from './jobs';
import { beginStage } from './staff';
import { splitRun } from '../street';
import { payAndFinish, type GuestContext } from './guests';

/** True when every tile of the path after the one being entered is still walkable. */
function pathStillOk(ctx: GuestContext, c: Character): boolean {
  // The sidewalk parts of a walk (arriving, leaving) are outside the grid: only the run inside counts.
  const { head, run } = splitRun(c.path);
  const goal = run[run.length - 1];
  return run.every((t, i) => {
    if (i === 0 && head.length === 0) return true; // being entered: placement refuses to cover it
    // The final tile may be a claimed chair (blocked on purpose).
    return isWalkable(ctx.walk, t.x, t.y) || (i === run.length - 1 && goal === t);
  });
}

/** Re-plans from the tile being entered to the old goal; null when there is no route. */
function replanned(ctx: GuestContext, c: Character): TilePos[] | null {
  const { head, run, tail } = splitRun(c.path);
  const next = run[0];
  const goal = run[run.length - 1];
  if (!next || !goal) return null;
  const path = findPath(ctx.walk, next, goal, {
    allowStartBlocked: true,
    allowGoalBlocked: !isWalkable(ctx.walk, goal.x, goal.y),
  });
  return path ? [...head, ...path, ...tail] : null;
}

function replanGuest(ctx: GuestContext, g: Guest): void {
  const path = replanned(ctx, g);
  if (path) {
    g.path = path;
    return;
  }
  // No route: finish the step in progress, then decide by what the guest was doing.
  g.path = g.path.slice(0, 1);
  if (g.phase === 'walkingToSeat') {
    g.seatId = null;
    g.phase = 'waitingForSeat';
    g.waitSpot = null;
    g.timer = secToTicks(GUEST_TYPES[g.typeId].seatPatienceSec);
  } else if (g.phase === 'leaving') {
    g.path = [];
    g.phase = 'gone'; // no way out: drop the guest so nobody can get stuck
  } else if (g.phase === 'toilet') {
    g.errand = null; // cannot reach the toilet any more: skip the visit and pay
    payAndFinish(ctx, g);
  } else if (g.waitSpot) {
    g.errand = null; // a snack trip that lost its route is dropped
    g.waitSpot = null; // the waiting spot is unreachable: pick again once standing still
  }
}

function replanStaff(ctx: GuestContext, s: Staff): void {
  if (s.phase === 'walkingToJob') {
    const job = s.jobId ? getJob(ctx.state, s.jobId) : undefined;
    if (job && beginStage(ctx, s, job)) return;
    // Cannot reach the station any more: give the job back to the queue.
    if (job) job.assigneeId = null;
    resetStaff(s);
    return;
  }
  const path = replanned(ctx, s);
  if (path) s.path = path;
  else s.path = s.path.slice(0, 1);
}

/**
 * After a furniture change: every character whose walk now crosses a blocked tile plans a new
 * route from the tile it is heading to (never mid-step), or falls back to a safe state.
 */
export function replanAfterBuild(ctx: GuestContext): void {
  for (const c of ctx.state.characters) {
    if (c.path.length === 0 || pathStillOk(ctx, c)) {
      // Staff aiming for a station that moved still need a fresh target.
      if (isStaff(c) && c.phase === 'walkingToJob') replanStaff(ctx, c);
      continue;
    }
    if (isGuest(c)) replanGuest(ctx, c);
    else if (isStaff(c)) replanStaff(ctx, c);
    else c.path = replanned(ctx, c) ?? c.path.slice(0, 1);
  }
}
