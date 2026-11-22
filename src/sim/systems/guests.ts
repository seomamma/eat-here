import { GUEST_PAY_SEC } from '../../data/balance';
import { LOVE_AT } from '../../data/happiness';
import { FURNITURE } from '../../data/furniture';
import { GUEST_TYPES } from '../../data/guests';
import { DOOR_X, WAITING_SPOTS } from '../../data/layout';
import { RECIPE_IDS, RECIPES } from '../../data/recipes';
import { dirFromStep, isGuest, stepCharacter, type Guest, type IsoDir } from '../characters';
import type { Emitter, GameEvents, GuestLeaveReason } from '../events';
import { buildOccupancy, type Furniture } from '../grid';
import { findPath, type TilePos, type WalkGrid } from '../pathfinding';
import { rngInt, rngPick } from '../rng';
import type { GameState } from '../state';
import { addFame } from './fame';
import { beginStep, checkSlow, fameFor, onSeated, onServed, tipFor } from './happiness';
import { isChairUsable } from './build';
import { requestOrder } from './jobs';
import { secToTicks, spawnGuest } from './spawner';

export interface GuestContext {
  state: GameState;
  walk: WalkGrid;
  events: Emitter<GameEvents>;
}

const NEIGHBOURS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function chairs(state: GameState): Furniture[] {
  return state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
}

function furnitureById(state: GameState, id: string): Furniture | undefined {
  return state.furniture.find((f) => f.id === id);
}

/** Direction a guest sitting on the chair faces: towards an adjacent table (else front). */
export function seatFacing(state: GameState, chair: Furniture): IsoDir {
  const occupancy = buildOccupancy(state.furniture);
  for (const [dx, dy] of NEIGHBOURS) {
    const id = occupancy.get(`${chair.x + dx},${chair.y + dy}`);
    const f = id ? furnitureById(state, id) : undefined;
    if (f && FURNITURE[f.defId].kind === 'table') return dirFromStep(dx, dy, 'dr');
  }
  return 'dr';
}

function currentTile(g: Guest): TilePos {
  return { x: Math.round(g.x), y: Math.round(g.y) };
}

/**
 * Plans a path for a guest. A guest between tiles first finishes the step it is on, so the path
 * starts from the tile it is heading to. Returns false (path untouched) when there is no route.
 */
function planPath(
  ctx: GuestContext,
  g: Guest,
  goal: TilePos,
  opts: { allowGoalBlocked?: boolean; allowStartBlocked?: boolean } = {},
): boolean {
  const from = g.path[0] ?? currentTile(g);
  const path = findPath(ctx.walk, from, goal, {
    ...opts,
    // Standing on a chair (blocked tile) is only possible for a seated/standing-up guest.
    allowStartBlocked: opts.allowStartBlocked && g.path.length === 0,
  });
  if (!path) return false;
  g.path = path;
  return true;
}

function randomTicks(state: GameState, range: readonly [number, number]): number {
  return rngInt(state, secToTicks(range[0]), secToTicks(range[1]));
}

/** Claims the nearest free reachable chair for the guest; returns true on success. */
function tryClaimSeat(ctx: GuestContext, g: Guest): boolean {
  const { state } = ctx;
  const taken = new Set<string>();
  for (const c of state.characters) if (isGuest(c) && c.seatId) taken.add(c.seatId);
  const here = currentTile(g);
  const free = chairs(state)
    .filter((f) => !taken.has(f.id) && isChairUsable(state, f))
    .map((f, i) => ({ f, i, d: Math.abs(f.x - here.x) + Math.abs(f.y - here.y) }))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  for (const { f } of free) {
    if (planPath(ctx, g, { x: f.x, y: f.y }, { allowGoalBlocked: true })) {
      g.seatId = f.id;
      g.phase = 'walkingToSeat';
      g.waitSpot = null;
      return true;
    }
  }
  return false;
}

function startLeaving(ctx: GuestContext, g: Guest, reason: GuestLeaveReason): void {
  g.phase = 'leaving';
  g.leaveReason = reason;
  const door = { x: DOOR_X, y: ctx.state.grid.height - 1 };
  if (!planPath(ctx, g, door, { allowStartBlocked: g.seatId !== null })) {
    // No route out (should not happen): drop the guest so it can never get stuck.
    g.path = [];
    g.phase = 'gone';
  }
}

/** Frees the claimed chair once the guest has fully stepped off it. */
function releaseSeatIfOff(ctx: GuestContext, g: Guest): void {
  if (!g.seatId) return;
  const chair = furnitureById(ctx.state, g.seatId);
  if (!chair || Math.abs(g.x - chair.x) + Math.abs(g.y - chair.y) >= 1) g.seatId = null;
}

/** The dish arrived: the guest starts eating (called by the staff system). */
export function startEating(ctx: GuestContext, g: Guest): void {
  g.phase = 'eating';
  g.timer = randomTicks(ctx.state, GUEST_TYPES[g.typeId].eatSec);
  onServed(ctx.state, g);
  ctx.events.emit('guestEmote', { guestId: g.id, emote: 'tasty' });
}

function updateGuest(ctx: GuestContext, g: Guest): void {
  const { state, events } = ctx;
  const type = GUEST_TYPES[g.typeId];
  stepCharacter(g, type.walkSpeed);
  checkSlow(state, events, g);
  const arrived = g.path.length === 0;

  switch (g.phase) {
    case 'arriving':
      if (arrived) {
        g.phase = 'waitingForSeat';
        g.timer = secToTicks(type.seatPatienceSec);
      }
      break;

    case 'waitingForSeat':
      if (tryClaimSeat(ctx, g)) break;
      if (state.clock.phase === 'closing') {
        // Closing time: nobody new gets seated, and this is not the guest's fault (no angry emote).
        startLeaving(ctx, g, 'closed');
        break;
      }
      if (--g.timer <= 0) {
        events.emit('guestEmote', { guestId: g.id, emote: 'angry' });
        startLeaving(ctx, g, 'noSeat');
        break;
      }
      if (!g.waitSpot && arrived) {
        const waiting = state.characters.filter((c) => isGuest(c) && c.waitSpot).length;
        const spot = WAITING_SPOTS[waiting % WAITING_SPOTS.length];
        if (spot) {
          g.waitSpot = { ...spot };
          planPath(ctx, g, spot);
        }
      }
      break;

    case 'walkingToSeat':
      if (arrived) {
        const chair = g.seatId ? furnitureById(state, g.seatId) : undefined;
        if (!chair) {
          startLeaving(ctx, g, 'noSeat');
          break;
        }
        g.dir = seatFacing(state, chair);
        g.phase = 'browsing';
        g.timer = randomTicks(state, type.browseSec);
        onSeated(state, g);
        events.emit('guestSeated', { guestId: g.id, seatId: chair.id });
      }
      break;

    case 'browsing':
      if (--g.timer <= 0) {
        const unlocked = RECIPE_IDS.filter((id) => state.recipes[id].unlocked);
        g.recipeId = rngPick(state, unlocked);
        g.phase = 'wantsToOrder';
        beginStep(state, g);
        events.emit('guestEmote', { guestId: g.id, emote: 'hand' });
        requestOrder(state, g, g.recipeId);
      }
      break;

    case 'wantsToOrder':
    case 'waitingForFood':
      // Passive: the staff system moves the guest on (order taken, dish served).
      break;

    case 'eating':
      if (--g.timer <= 0) {
        g.phase = 'paying';
        g.timer = secToTicks(GUEST_PAY_SEC);
        const price = g.recipeId ? RECIPES[g.recipeId].price : 0;
        const tip = tipFor(price, g.happiness);
        const fame = fameFor(g.happiness);
        state.money += price + tip;
        events.emit('paid', {
          guestId: g.id,
          price,
          tip,
          amount: price + tip,
          fame,
          x: g.x,
          y: g.y,
        });
        events.emit('moneyChanged', { money: state.money });
        addFame(state, events, fame);
        if (g.happiness >= LOVE_AT) events.emit('guestEmote', { guestId: g.id, emote: 'love' });
      }
      break;

    case 'paying':
      if (--g.timer <= 0) startLeaving(ctx, g, 'done');
      break;

    case 'leaving':
      releaseSeatIfOff(ctx, g);
      if (arrived) g.phase = 'gone';
      break;

    case 'gone':
      break;
  }
}

/** Spawns arrivals, advances every guest by one tick and removes the ones that are gone. */
export function tickGuests(ctx: GuestContext): void {
  const { state, events } = ctx;
  const fresh = spawnGuest(state);
  if (fresh) {
    state.characters.push(fresh);
    events.emit('guestArrived', { guestId: fresh.id });
  }
  for (const c of state.characters) {
    if (isGuest(c)) updateGuest(ctx, c);
  }
  state.characters = state.characters.filter((c) => {
    if (!isGuest(c) || c.phase !== 'gone') return true;
    events.emit('guestLeft', { guestId: c.id, reason: c.leaveReason ?? 'done' });
    return false;
  });
}
