import { DAYS_PER_WEEK, MAX_GUESTS_ALIVE } from '../../data/balance';
import {
  HEART_MIN_HAPPINESS,
  MAX_HEARTS,
  REGULAR_FAME_MULT,
  REGULAR_IDS,
  VISIT_WINDOWS,
  regularDef,
  type RegularId,
} from '../../data/regulars';
import type { RecipeId } from '../../data/recipes';
import { isGuest, type Guest } from '../characters';
import type { Emitter, GameEvents } from '../events';
import { rngInt, rngNext } from '../rng';
import type { GameState } from '../state';
import { weekdayIndex } from '../time';
import { createGuest } from './spawner';

export interface RegularState {
  unlocked: boolean;
  hearts: number;
  visits: number;
  /** Day of the latest arrival (0 = never). One visit per day. */
  lastVisitDay: number;
  /** Day the latest heart was given (0 = never). One heart per day. */
  lastHeartDay: number;
  /** Today's planned arrival: `minute` null = the window has passed, no visit today. */
  plan: { day: number; minute: number | null } | null;
  /** Guest id of the regular whose companion has not arrived yet (it follows once they sit). */
  companionDue: string | null;
}

export type RegularStates = Record<RegularId, RegularState>;

/** Totals the moment triggers read (D-036). */
export interface Counters {
  /** Dishes served (paid) per recipe. */
  served: Partial<Record<RecipeId, number>>;
  /** Highest recipe level at which a dish of the recipe was served. */
  servedLevel: Partial<Record<RecipeId, number>>;
  /** Ad campaigns started (M12c). */
  campaigns: number;
}

export function createRegularState(): RegularState {
  return {
    unlocked: false,
    hearts: 0,
    visits: 0,
    lastVisitDay: 0,
    lastHeartDay: 0,
    plan: null,
    companionDue: null,
  };
}

export function createRegularStates(): RegularStates {
  const out = {} as RegularStates;
  for (const id of REGULAR_IDS) out[id] = createRegularState();
  return out;
}

export function createCounters(): Counters {
  return { served: {}, servedLevel: {}, campaigns: 0 };
}

/** A dish was paid for: updates the totals the moment triggers read. */
export function recordServed(state: GameState, recipeId: RecipeId): void {
  const { counters } = state;
  counters.served[recipeId] = (counters.served[recipeId] ?? 0) + 1;
  const level = state.recipes[recipeId].level;
  if (level > (counters.servedLevel[recipeId] ?? 0)) counters.servedLevel[recipeId] = level;
}

/** The regular's favorite when it is on the menu (they always order it), else null. */
export function usualRecipe(state: GameState, g: Guest): RecipeId | null {
  if (!g.regularId) return null;
  const fav = regularDef(g.regularId).favorite;
  return state.recipes[fav].unlocked ? fav : null;
}

/** Fame multiplier of a guest (regulars give more). */
export function fameMultiplier(g: Guest): number {
  return g.regularId ? REGULAR_FAME_MULT : 1;
}

/** Seconds a guest waits for a seat before giving up. */
export function seatPatienceSec(g: Guest, base: number): number {
  return g.regularId ? regularDef(g.regularId).seatPatienceSec : base;
}

/** A regular paid: a happy visit gives one heart (at most one per day, up to the cap). */
export function onRegularPaid(state: GameState, events: Emitter<GameEvents>, g: Guest): boolean {
  if (!g.regularId) return false;
  const reg = state.regulars[g.regularId];
  if (g.happiness < HEART_MIN_HAPPINESS) return false;
  if (reg.hearts >= MAX_HEARTS || reg.lastHeartDay === state.clock.day) return false;
  reg.hearts++;
  reg.lastHeartDay = state.clock.day;
  events.emit('heartGained', { regularId: g.regularId, guestId: g.id, hearts: reg.hearts });
  return true;
}

/** Day of the regular's next visit: today if still to come, else the next matching weekday. */
export function nextVisitDay(
  regularId: RegularId,
  currentDay: number,
  lastVisitDay: number,
): number {
  const days = regularDef(regularId).visitDays;
  for (let d = currentDay; d < currentDay + DAYS_PER_WEEK + 1; d++) {
    if (days.includes(weekdayIndex(d)) && d !== lastVisitDay) return d;
  }
  return currentDay;
}

/** Rolls today's arrival minute (seeded) inside the window, not earlier than now. */
function planVisit(state: GameState, id: RegularId): void {
  const reg = state.regulars[id];
  const [from, to] = VISIT_WINDOWS[regularDef(id).visitWindow];
  const now = Math.floor(state.clock.minuteOfDay);
  const day = state.clock.day;
  reg.plan = { day, minute: now >= to ? null : rngInt(state, Math.max(from, now), to) };
}

function companionComes(state: GameState, id: RegularId): boolean {
  const companion = regularDef(id).companion;
  if (!companion || state.regulars[id].hearts < companion.minHearts) return false;
  return rngNext(state) < companion.chance;
}

/**
 * Arrivals of regulars: on a visit day each unlocked regular arrives once, at a seeded minute
 * inside their window, and a regular's companion follows once the regular has a seat.
 * Returns the new guests (the caller adds them to the room and announces them).
 */
export function spawnRegularGuests(state: GameState, events: Emitter<GameEvents>): Guest[] {
  const out: Guest[] = [];
  const open = state.guestSpawn.enabled && state.clock.phase === 'open';
  const alive = () => state.characters.filter(isGuest).length + out.length;
  const day = state.clock.day;
  const minute = state.clock.minuteOfDay;
  for (const id of REGULAR_IDS) {
    const reg = state.regulars[id];
    const def = regularDef(id);
    // Companion: follows as soon as the regular sits (so both can share a table when possible).
    if (reg.companionDue) {
      const partner = state.characters.find((c) => c.id === reg.companionDue);
      if (!partner || !isGuest(partner) || partner.phase === 'leaving') {
        reg.companionDue = null;
      } else if (open && partner.seatId && alive() < MAX_GUESTS_ALIVE && def.companion) {
        const c = def.companion;
        out.push(
          createGuest(state, { variant: 0, name: c.name, look: c.look, companionOf: partner.id }),
        );
        reg.companionDue = null;
      }
    }
    if (!open || !reg.unlocked || reg.lastVisitDay === day) continue;
    if (!def.visitDays.includes(weekdayIndex(day))) continue;
    if (reg.plan?.day !== day) planVisit(state, id);
    const at = reg.plan?.minute ?? null;
    if (at === null || minute < at) continue;
    const withCompanion = companionComes(state, id);
    const guest = createGuest(state, {
      variant: 0,
      name: def.name,
      look: def.look,
      regularId: id,
    });
    reg.lastVisitDay = day;
    reg.visits++;
    if (withCompanion) reg.companionDue = guest.id;
    out.push(guest);
    events.emit('regularArrived', { regularId: id, guestId: guest.id });
  }
  return out;
}
