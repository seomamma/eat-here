import { STAFF, STAFF_ACTION_SEC, staffStats } from '../../data/staff';
import { RECIPES } from '../../data/recipes';
import {
  dirFromStep,
  isStaff,
  stepCharacter,
  type IsoDir,
  type Staff,
  type StaffAction,
} from '../characters';
import { findPath, isWalkable, type TilePos } from '../pathfinding';
import { startEating, type GuestContext } from './guests';
import { onOrderTaken } from './happiness';
import {
  addJob,
  cancelStaleJobs,
  getGuest,
  getJob,
  getOrder,
  removeJob,
  reservePassSlot,
  resetStaff,
  stationSpot,
  type Job,
  type JobKind,
} from './jobs';
import { secToTicks } from './spawner';

/**
 * Staff state machine: idle -> walkingToJob -> working(action, timer) -> ... -> idle.
 * A job runs through stages (the `stage` string on the staff):
 *   takeOrder: go -> act
 *   cook:      goOven -> bake -> goPass -> place
 *   deliver:   goPass -> pickUp -> goGuest -> serve
 * `go*` stages walk to a tile and then start the next action; the others are timed actions.
 */

const FIRST_STAGE: Record<JobKind, string> = {
  takeOrder: 'go',
  cook: 'goOven',
  deliver: 'goPass',
};

function tileOf(s: Staff): TilePos {
  return { x: Math.round(s.x), y: Math.round(s.y) };
}

function at(s: Staff, t: TilePos): boolean {
  return Math.abs(s.x - t.x) < 1e-6 && Math.abs(s.y - t.y) < 1e-6;
}

function dist(a: TilePos, b: TilePos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Free floor tiles next to the guest's chair, nearest to the staff first. */
function guestTiles(ctx: GuestContext, s: Staff, job: Job): TilePos[] {
  const guest = getGuest(ctx.state, job.guestId);
  const chair = guest?.seatId ? ctx.state.furniture.find((f) => f.id === guest.seatId) : undefined;
  if (!chair) return [];
  const here = tileOf(s);
  return [
    { x: chair.x + 1, y: chair.y },
    { x: chair.x, y: chair.y + 1 },
    { x: chair.x - 1, y: chair.y },
    { x: chair.x, y: chair.y - 1 },
  ]
    .filter((t) => isWalkable(ctx.walk, t.x, t.y))
    .map((t, i) => ({ t, i, d: dist(t, here) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((e) => e.t);
}

/** Tiles the current stage walks to (best first); empty when the station is missing. */
function stageTargets(ctx: GuestContext, s: Staff, job: Job): TilePos[] {
  const { state } = ctx;
  switch (s.stage) {
    case 'go':
    case 'goGuest':
      return guestTiles(ctx, s, job);
    case 'goOven': {
      const spot = stationSpot(state, 'oven', 0);
      return spot ? [spot.tile] : [];
    }
    case 'goPass': {
      const spot = stationSpot(state, 'pass', job.kind === 'cook' ? 0 : 1);
      return spot ? [spot.tile] : [];
    }
    default:
      return [];
  }
}

/** Direction to face while working at the current stage's station or guest. */
function workFacing(ctx: GuestContext, s: Staff, job: Job): IsoDir {
  const { state } = ctx;
  if (s.stage === 'goOven') return stationSpot(state, 'oven', 0)?.dir ?? s.dir;
  if (s.stage === 'goPass')
    return stationSpot(state, 'pass', job.kind === 'cook' ? 0 : 1)?.dir ?? s.dir;
  const guest = getGuest(state, job.guestId);
  const chair = guest?.seatId ? state.furniture.find((f) => f.id === guest.seatId) : undefined;
  return chair ? dirFromStep(chair.x - s.x, chair.y - s.y, s.dir) : s.dir;
}

/** Plans the walk of the current stage; on failure the target stays null and it is retried. */
function beginStage(ctx: GuestContext, s: Staff, job: Job): boolean {
  for (const t of stageTargets(ctx, s, job)) {
    // A staff member between tiles first finishes the step it is on.
    const from = s.path[0] ?? tileOf(s);
    const path = findPath(ctx.walk, from, t);
    if (path) {
      s.path = path;
      s.target = t;
      return true;
    }
  }
  s.target = null;
  return false;
}

function startWork(s: Staff, action: StaffAction, sec: number, dir: IsoDir): void {
  s.phase = 'working';
  s.action = action;
  s.timer = secToTicks(sec);
  s.dir = dir;
}

function goStage(ctx: GuestContext, s: Staff, job: Job, stage: string): void {
  s.phase = 'walkingToJob';
  s.action = null;
  s.stage = stage;
  s.target = null;
  beginStage(ctx, s, job);
}

function finishJob(ctx: GuestContext, s: Staff, job: Job): void {
  removeJob(ctx.state, job.id);
  resetStaff(s);
}

/** Arrived at the stage's tile: start the next timed action. */
function arrive(ctx: GuestContext, s: Staff, job: Job): void {
  const { state, events } = ctx;
  const order = getOrder(state, job.orderId);
  if (!order) return;
  const stats = staffStats(s.role);
  const face = workFacing(ctx, s, job);
  switch (s.stage) {
    case 'go':
      s.stage = 'act';
      startWork(s, 'takeOrder', STAFF_ACTION_SEC.takeOrder / stats.service, face);
      break;
    case 'goOven': {
      const recipe = RECIPES[order.recipeId];
      order.status = 'cooking';
      state.money -= recipe.ingredientCost; // may go negative for now; the cost is tiny
      events.emit('ingredientsBought', { orderId: order.id, amount: recipe.ingredientCost });
      events.emit('moneyChanged', { money: state.money });
      s.stage = 'bake';
      startWork(s, 'cook', recipe.cookTimeSec / stats.cooking, face);
      break;
    }
    case 'goPass':
      if (job.kind === 'cook') {
        if (!reservePassSlot(state, order)) return; // pass full: wait here and retry
        s.stage = 'place';
        startWork(s, 'placeDish', STAFF_ACTION_SEC.placeDish / stats.service, face);
      } else {
        s.stage = 'pickUp';
        startWork(s, 'pickUpDish', STAFF_ACTION_SEC.pickUpDish / stats.service, face);
      }
      break;
    case 'goGuest':
      s.stage = 'serve';
      startWork(s, 'serveDish', STAFF_ACTION_SEC.serveDish / stats.service, face);
      break;
  }
}

/** The timed action ran out: apply its result and move on. */
function finishAction(ctx: GuestContext, s: Staff, job: Job): void {
  const { state, events } = ctx;
  const order = getOrder(state, job.orderId);
  if (!order) return;
  switch (s.stage) {
    case 'act': {
      order.status = 'queued';
      const guest = getGuest(state, order.guestId);
      if (guest) {
        guest.phase = 'waitingForFood';
        onOrderTaken(state, guest);
      }
      addJob(state, 'cook', order);
      events.emit('orderTaken', {
        orderId: order.id,
        guestId: order.guestId,
        recipeId: order.recipeId,
      });
      finishJob(ctx, s, job);
      break;
    }
    case 'bake':
      s.carrying = order.recipeId;
      goStage(ctx, s, job, 'goPass');
      break;
    case 'place':
      order.status = 'ready';
      s.carrying = null;
      events.emit('dishReady', { orderId: order.id });
      addJob(state, 'deliver', order);
      finishJob(ctx, s, job);
      break;
    case 'pickUp':
      order.status = 'delivering';
      order.slot = null;
      s.carrying = order.recipeId;
      goStage(ctx, s, job, 'goGuest');
      break;
    case 'serve': {
      order.status = 'served';
      state.orders = state.orders.filter((o) => o !== order);
      const guest = getGuest(state, order.guestId);
      if (guest) startEating(ctx, guest);
      events.emit('dishServed', { orderId: order.id, guestId: order.guestId });
      finishJob(ctx, s, job);
      break;
    }
  }
}

/** Rough distance from the staff to where a job starts (tie-break between equally old jobs). */
function jobDistance(ctx: GuestContext, s: Staff, job: Job): number {
  const here = tileOf(s);
  if (job.kind === 'takeOrder') {
    const g = getGuest(ctx.state, job.guestId);
    return g ? dist(here, { x: Math.round(g.x), y: Math.round(g.y) }) : 0;
  }
  const spot =
    job.kind === 'cook' ? stationSpot(ctx.state, 'oven', 0) : stationSpot(ctx.state, 'pass', 1);
  return spot ? dist(here, spot.tile) : 0;
}

/** Claims the oldest unclaimed job this role can do (tie: nearest) that has a route. */
function pickJob(ctx: GuestContext, s: Staff): boolean {
  const kinds: readonly JobKind[] = STAFF[s.role].jobKinds;
  const open = ctx.state.jobs
    .map((job, i) => ({ job, i, d: jobDistance(ctx, s, job) }))
    .filter((e) => !e.job.assigneeId && kinds.includes(e.job.kind))
    .sort((a, b) => a.job.createdTick - b.job.createdTick || a.d - b.d || a.i - b.i);
  for (const { job } of open) {
    s.jobId = job.id;
    s.phase = 'walkingToJob';
    s.stage = FIRST_STAGE[job.kind];
    if (beginStage(ctx, s, job)) {
      job.assigneeId = s.id;
      return true;
    }
    s.jobId = null;
    s.phase = 'idle';
    s.stage = '';
  }
  return false;
}

function updateStaff(ctx: GuestContext, s: Staff): void {
  stepCharacter(s, STAFF[s.role].walkSpeed * staffStats(s.role).speed);
  const job = s.jobId ? getJob(ctx.state, s.jobId) : undefined;
  if (s.jobId && !job) resetStaff(s); // defensive: the job vanished

  switch (s.phase) {
    case 'idle':
      if (pickJob(ctx, s)) break;
      if (s.path.length === 0 && !at(s, s.home)) {
        const path = findPath(ctx.walk, tileOf(s), s.home);
        if (path) s.path = path;
      }
      break;

    case 'walkingToJob':
      if (!job) break;
      if (s.path.length > 0) break;
      if (s.target && at(s, s.target)) arrive(ctx, s, job);
      else beginStage(ctx, s, job); // no route earlier: retry
      break;

    case 'working':
      if (job && --s.timer <= 0) finishAction(ctx, s, job);
      break;
  }
}

/** Cancels stale jobs, then advances every staff member by one tick. */
export function tickStaff(ctx: GuestContext): void {
  cancelStaleJobs(ctx.state, ctx.events);
  for (const c of ctx.state.characters) {
    if (isStaff(c)) updateStaff(ctx, c);
  }
}
