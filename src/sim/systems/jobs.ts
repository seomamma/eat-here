import { PASS_SLOTS } from '../../data/balance';
import { FURNITURE } from '../../data/furniture';
import type { JobKind } from '../../data/staff';
import type { RecipeId } from '../../data/recipes';
import { FACING_DIR, isGuest, isStaff, type Guest, type IsoDir, type Staff } from '../characters';
import type { Emitter, GameEvents } from '../events';
import { rotatedUseSpots, type Furniture } from '../grid';
import type { TilePos } from '../pathfinding';
import type { GameState } from '../state';

export type { JobKind };

/** waitingToBeTaken -> queued (cook job) -> cooking -> ready (on pass) -> delivering -> served. */
export type OrderStatus =
  'waitingToBeTaken' | 'queued' | 'cooking' | 'ready' | 'delivering' | 'served';

export interface Order {
  id: string;
  guestId: string;
  recipeId: RecipeId;
  status: OrderStatus;
  /** Pass slot reserved for this dish (set while placing / while on the pass), else null. */
  slot: number | null;
}

export interface Job {
  id: string;
  kind: JobKind;
  guestId: string;
  orderId: string;
  /** Staff id that claimed the job; the claim is what keeps two staff off one job. */
  assigneeId: string | null;
  createdTick: number;
}

export function getOrder(state: GameState, id: string): Order | undefined {
  return state.orders.find((o) => o.id === id);
}

export function getJob(state: GameState, id: string): Job | undefined {
  return state.jobs.find((j) => j.id === id);
}

export function getGuest(state: GameState, id: string): Guest | undefined {
  const c = state.characters.find((x) => x.id === id);
  return c && isGuest(c) ? c : undefined;
}

export function addJob(state: GameState, kind: JobKind, order: Order): Job {
  const job: Job = {
    id: `job${state.nextJobId++}`,
    kind,
    guestId: order.guestId,
    orderId: order.id,
    assigneeId: null,
    createdTick: state.tick,
  };
  state.jobs.push(job);
  return job;
}

/** A guest wants to order: creates the order and its takeOrder job. */
export function requestOrder(state: GameState, guest: Guest, recipeId: RecipeId): Order {
  const order: Order = {
    id: `order${state.nextOrderId++}`,
    guestId: guest.id,
    recipeId,
    status: 'waitingToBeTaken',
    slot: null,
  };
  state.orders.push(order);
  addJob(state, 'takeOrder', order);
  return order;
}

export function removeJob(state: GameState, jobId: string): void {
  state.jobs = state.jobs.filter((j) => j.id !== jobId);
}

/** Puts a staff member back to idle, finishing the step it is on (never stops between tiles). */
export function resetStaff(s: Staff): void {
  s.phase = 'idle';
  s.jobId = null;
  s.stage = '';
  s.target = null;
  s.action = null;
  s.timer = 0;
  s.carrying = null;
  s.path = s.path.slice(0, 1);
}

function releaseAssignee(state: GameState, assigneeId: string | null): void {
  if (!assigneeId) return;
  const s = state.characters.find((c) => c.id === assigneeId);
  if (s && isStaff(s)) resetStaff(s);
}

/** Drops an order and every job for it; the assigned staff return to idle. */
export function discardOrder(state: GameState, events: Emitter<GameEvents>, order: Order): void {
  for (const j of state.jobs) if (j.orderId === order.id) releaseAssignee(state, j.assigneeId);
  state.jobs = state.jobs.filter((j) => j.orderId !== order.id);
  state.orders = state.orders.filter((o) => o !== order);
  events.emit('orderDiscarded', { orderId: order.id, guestId: order.guestId });
}

/** Cancels orders/jobs whose guest left (or is leaving) and jobs without an order. */
export function cancelStaleJobs(state: GameState, events: Emitter<GameEvents>): void {
  for (const order of [...state.orders]) {
    const guest = getGuest(state, order.guestId);
    if (!guest || guest.phase === 'leaving' || guest.phase === 'gone') {
      discardOrder(state, events, order);
    }
  }
  for (const job of [...state.jobs]) {
    if (!getOrder(state, job.orderId)) {
      releaseAssignee(state, job.assigneeId);
      removeJob(state, job.id);
    }
  }
}

// ---- Stations -----------------------------------------------------------------------------

export interface Spot {
  tile: TilePos;
  dir: IsoDir;
}

/** Use spot `index` of the first furniture of the given kind, or null. */
export function stationSpot(state: GameState, kind: 'oven' | 'pass', index: number): Spot | null {
  const f: Furniture | undefined = state.furniture.find((x) => FURNITURE[x.defId].kind === kind);
  const spot = f ? rotatedUseSpots(f.defId, f.rot)[index] : undefined;
  if (!f || !spot) return null;
  return { tile: { x: f.x + spot.dx, y: f.y + spot.dy }, dir: FACING_DIR[spot.facing] };
}

/** Reserves the first free pass slot for the order; returns false when the pass is full. */
export function reservePassSlot(state: GameState, order: Order): boolean {
  if (order.slot !== null) return true;
  for (let i = 0; i < PASS_SLOTS; i++) {
    if (!state.orders.some((o) => o.slot === i)) {
      order.slot = i;
      return true;
    }
  }
  return false;
}
