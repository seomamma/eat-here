import { FIRST_GUEST_SEC, SPAWN_CURVE, MAX_GUESTS_ALIVE, TICK_MS } from '../../data/balance';
import { GUEST_NAMES, GUEST_TYPES, type GuestTypeId } from '../../data/guests';
import { rankDef } from '../../data/ranks';
import { DOOR_X } from '../../data/layout';
import type { LookId, RegularId } from '../../data/regulars';
import { isGuest, type Guest } from '../characters';
import { rngInt, rngPick } from '../rng';
import type { GameState } from '../state';

export function secToTicks(sec: number): number {
  return Math.max(1, Math.round((sec * 1000) / TICK_MS));
}

/** Ticks until the next arrival, drawn from the seeded RNG. */
function rollSpawnDelay(state: GameState): number {
  const minute = state.clock.minuteOfDay;
  let [min, max] = SPAWN_CURVE[0]?.intervalSec ?? [10, 10];
  for (const seg of SPAWN_CURVE) {
    if (seg.fromMinute <= minute) [min, max] = seg.intervalSec;
  }
  const base = rngInt(state, secToTicks(min), secToTicks(max));
  return Math.max(1, Math.round(base / rankDef(state.rank).spawnRate));
}

/** First-arrival delay of a fresh game (also used by the initial state). */
export const FIRST_GUEST_TICKS = secToTicks(FIRST_GUEST_SEC);

/** Counts down to the next arrival and returns a new guest standing on the door tile, or null. */
export function spawnGuest(state: GameState): Guest | null {
  const sp = state.guestSpawn;
  if (!sp.enabled) return null;
  if (--sp.nextInTicks > 0) return null;
  sp.nextInTicks = rollSpawnDelay(state);
  if (state.characters.filter(isGuest).length >= MAX_GUESTS_ALIVE) return null;

  return createGuest(state, {
    variant: rngInt(state, 0, GUEST_TYPES.local.variants - 1),
    name: rngPick(state, GUEST_NAMES),
  });
}

export interface NewGuest {
  variant: number;
  name: string;
  regularId?: RegularId;
  look?: LookId;
  companionOf?: string;
}

/** A new guest standing on the door tile, walking one tile in. */
export function createGuest(state: GameState, o: NewGuest): Guest {
  const typeId: GuestTypeId = 'local';
  const x = DOOR_X;
  const y = state.grid.height - 1;
  return {
    id: `guest${state.nextGuestId++}`,
    kind: 'guest',
    typeId,
    variant: o.variant,
    regularId: o.regularId ?? null,
    look: o.look ?? null,
    companionOf: o.companionOf ?? null,
    name: o.name,
    happiness: 0,
    happinessLog: [],
    stepTick: state.tick,
    slowShown: false,
    phase: 'arriving',
    timer: 0,
    seatId: null,
    waitSpot: null,
    errand: null,
    snackAsked: false,
    recipeId: null,
    leaveReason: null,
    x,
    y,
    prevX: x,
    prevY: y,
    // Walk in one tile from the door.
    path: [{ x, y: y - 1 }],
    dir: 'ur',
  };
}
