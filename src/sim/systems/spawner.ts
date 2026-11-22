import {
  FIRST_GUEST_SEC,
  GUEST_SPAWN_INTERVAL_SEC,
  MAX_GUESTS_ALIVE,
  TICK_MS,
} from '../../data/balance';
import { GUEST_TYPES, type GuestTypeId } from '../../data/guests';
import { DOOR_X } from '../../data/layout';
import { isGuest, type Guest } from '../characters';
import { rngInt } from '../rng';
import type { GameState } from '../state';

export function secToTicks(sec: number): number {
  return Math.max(1, Math.round((sec * 1000) / TICK_MS));
}

/** Ticks until the next arrival, drawn from the seeded RNG. */
function rollSpawnDelay(state: GameState): number {
  const [min, max] = GUEST_SPAWN_INTERVAL_SEC;
  return rngInt(state, secToTicks(min), secToTicks(max));
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

  const typeId: GuestTypeId = 'local';
  const x = DOOR_X;
  const y = state.grid.height - 1;
  return {
    id: `guest${state.nextGuestId++}`,
    kind: 'guest',
    typeId,
    variant: rngInt(state, 0, GUEST_TYPES[typeId].variants - 1),
    phase: 'arriving',
    timer: 0,
    seatId: null,
    waitSpot: null,
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
