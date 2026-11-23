import { FIRST_GUEST_SEC, SPAWN_CURVE, MAX_GUESTS_ALIVE, TICK_MS } from '../../data/balance';
import { GUEST_NAMES, GUEST_TYPES, type GuestTypeId } from '../../data/guests';
import { KID_NAMES, KID_VARIANTS } from '../../data/parties';
import { rankDef } from '../../data/ranks';
import { DOOR_X, DOOR_Y } from '../../data/layout';
import { STREET_FOLLOWER_GAP } from '../../data/street';
import type { LookId, RegularId } from '../../data/regulars';
import { isGuest, type Guest } from '../characters';
import { furnitureAt } from '../grid';
import { rngInt, rngNext, rngPick } from '../rng';
import type { GameState } from '../state';
import { approachPath, type StreetSide } from '../street';
import { appealMultiplier, campaignMultiplier } from './campaigns';
import { partySize, rollPartyPlan, type PartyPlan } from './parties';

export function secToTicks(sec: number): number {
  return Math.max(1, Math.round((sec * 1000) / TICK_MS));
}

/** Arrival-rate multiplier right now: rank, running campaign and the room's curb appeal. */
export function arrivalMultiplier(state: GameState): number {
  return rankDef(state.rank).spawnRate * campaignMultiplier(state) * appealMultiplier(state);
}

/** Ticks until the next arrival (a party), drawn from the seeded RNG. */
function rollSpawnDelay(state: GameState): number {
  const minute = state.clock.minuteOfDay;
  let [min, max] = SPAWN_CURVE[0]?.intervalSec ?? [10, 10];
  for (const seg of SPAWN_CURVE) {
    if (seg.fromMinute <= minute) [min, max] = seg.intervalSec;
  }
  const base = rngInt(state, secToTicks(min), secToTicks(max));
  return Math.max(1, Math.round(base / arrivalMultiplier(state)));
}

/** First-arrival delay of a fresh game (also used by the initial state). */
export const FIRST_GUEST_TICKS = secToTicks(FIRST_GUEST_SEC);

/**
 * Counts down to the next arrival and returns the new party (one guest, a couple, friends or a
 * family) standing on the sidewalk, or an empty list. The caller adds them to the characters.
 */
export function spawnParty(state: GameState): Guest[] {
  const sp = state.guestSpawn;
  if (!sp.enabled) return [];
  if (--sp.nextInTicks > 0) return [];
  sp.nextInTicks = rollSpawnDelay(state);
  return createPartyIfRoom(state, rollPartyPlan(state));
}

/** The party of the plan, unless the restaurant has no room for that many more guests. */
export function createPartyIfRoom(state: GameState, plan: PartyPlan): Guest[] {
  const alive = state.characters.filter(isGuest).length;
  if (alive + partySize(plan) > MAX_GUESTS_ALIVE) return [];
  return createParty(state, plan);
}

/** Arrivals of the radio rush: the parties whose minute has come (dropped when the room is full). */
export function spawnRushParties(state: GameState): Guest[] {
  const rush = state.campaign?.rush;
  if (!rush || state.clock.phase !== 'open' || state.clock.day !== rush.day) return [];
  const out: Guest[] = [];
  const alive = state.characters.filter(isGuest).length;
  while (rush.pending.length > 0 && state.clock.minuteOfDay >= (rush.pending[0] as number)) {
    rush.pending.shift();
    const plan = rollPartyPlan(state);
    if (alive + out.length + partySize(plan) > MAX_GUESTS_ALIVE) continue;
    out.push(...createParty(state, plan));
  }
  return out;
}

/**
 * Creates the guests of one party on the sidewalk, in a line (leader first, the rest one tile
 * behind each other) all walking the same way, and registers the party when it has 2+ members.
 */
export function createParty(state: GameState, plan: PartyPlan): Guest[] {
  const side: StreetSide = rngNext(state) < 0.5 ? 1 : -1;
  const partyId = partySize(plan) > 1 ? `party${state.nextPartyId++}` : null;
  const members: Guest[] = [];
  const total = partySize(plan);
  for (let i = 0; i < total; i++) {
    const kid = i >= plan.adults;
    members.push(
      createGuest(state, {
        variant: kid
          ? rngInt(state, 0, KID_VARIANTS - 1)
          : rngInt(state, 0, GUEST_TYPES.local.variants - 1),
        name: kid ? rngPick(state, KID_NAMES) : rngPick(state, GUEST_NAMES),
        kid,
        partyId,
        side,
        behind: i * STREET_FOLLOWER_GAP,
      }),
    );
  }
  if (partyId) {
    state.parties.push({ id: partyId, kind: plan.kind, memberIds: members.map((m) => m.id) });
  }
  return members;
}

export interface NewGuest {
  variant: number;
  name: string;
  regularId?: RegularId;
  look?: LookId;
  companionOf?: string;
  kid?: boolean;
  partyId?: string | null;
  /** Sidewalk side the guest comes from (default: by guest number, no RNG). */
  side?: StreetSide;
  /** Tiles further out along the sidewalk than the first guest of the party. */
  behind?: number;
}

/** A new guest on the sidewalk, walking along it and in through the door. */
export function createGuest(state: GameState, o: NewGuest): Guest {
  const typeId: GuestTypeId = 'local';
  const n = state.nextGuestId++;
  const side: StreetSide = o.side ?? (n % 2 === 0 ? 1 : -1);
  const entryBlocked = furnitureAt(state, DOOR_X, DOOR_Y - 1) !== undefined;
  const { start, path } = approachPath(side, o.behind ?? 0, entryBlocked);
  return {
    id: `guest${n}`,
    kind: 'guest',
    typeId,
    variant: o.variant,
    regularId: o.regularId ?? null,
    look: o.look ?? null,
    companionOf: o.companionOf ?? null,
    kid: o.kid ?? false,
    partyId: o.partyId ?? null,
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
    x: start.x,
    y: start.y,
    prevX: start.x,
    prevY: start.y,
    path,
    dir: side === 1 ? 'ul' : 'dr',
  };
}
