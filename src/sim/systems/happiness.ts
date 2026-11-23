import {
  DECOR_CAP,
  DECOR_RADIUS,
  FAME_DIVISOR,
  FOOD_QUICK_SEC,
  HAPPINESS_MAX,
  HAPPINESS_POINTS,
  ORDER_QUICK_SEC,
  QUALITY_BASE,
  QUALITY_PER_LEVEL,
  SEAT_QUICK_SEC,
  TIP_DIVISOR,
} from '../../data/happiness';
import { FURNITURE } from '../../data/furniture';
import { PARTY_BONUS_POINTS, PARTY_KINDS } from '../../data/parties';
import type { Guest, GuestPhase } from '../characters';
import type { Emitter, GameEvents } from '../events';
import { FACING_STEP, buildOccupancy, chairFacing, footprintTiles, type Furniture } from '../grid';
import type { GameState } from '../state';
import { appealOf, auraPoints, comfortOf } from './facilities';
import { secToTicks } from './spawner';
import { surfacePoints } from './surfaces';

export type HappinessReason =
  | 'welcome'
  | 'seated'
  | 'order'
  | 'food'
  | 'quality'
  | 'decor'
  | 'usual'
  | 'comfort'
  | 'music'
  | 'toilet'
  | 'snack'
  | 'friends'
  | 'family';

export interface HappinessEntry {
  reason: HappinessReason;
  points: number;
}

/** Adds points to the meter (clamped to 0..max) and logs them; zero points are not logged. */
export function awardHappiness(g: Guest, reason: HappinessReason, points: number): void {
  if (points <= 0) return;
  const before = g.happiness;
  g.happiness = Math.min(HAPPINESS_MAX, g.happiness + points);
  const gained = g.happiness - before;
  if (gained > 0) g.happinessLog.push({ reason, points: gained });
}

/** Seconds a step may take and still count as quick, per phase of the guest. */
export function quickSecOf(phase: GuestPhase): number | null {
  switch (phase) {
    case 'arriving':
    case 'waitingForSeat':
    case 'walkingToSeat':
      return SEAT_QUICK_SEC;
    case 'wantsToOrder':
      return ORDER_QUICK_SEC;
    case 'waitingForFood':
      return FOOD_QUICK_SEC;
    default:
      return null;
  }
}

function tookAtMost(state: GameState, g: Guest, sec: number): boolean {
  return state.tick - g.stepTick <= secToTicks(sec);
}

/** Starts timing the next step of the guest's visit. */
export function beginStep(state: GameState, g: Guest): void {
  g.stepTick = state.tick;
  g.slowShown = false;
}

/** Shows the "slow" emote once when the current step has taken longer than "quick". */
export function checkSlow(state: GameState, events: Emitter<GameEvents>, g: Guest): void {
  const quick = quickSecOf(g.phase);
  if (quick === null || g.slowShown || tookAtMost(state, g, quick)) return;
  g.slowShown = true;
  events.emit('guestEmote', { guestId: g.id, emote: 'slow' });
}

/** The guest sat down: the welcome bonus is always given, quick seating pays extra. */
export function onSeated(state: GameState, g: Guest): void {
  awardHappiness(g, 'welcome', HAPPINESS_POINTS.welcome);
  if (tookAtMost(state, g, SEAT_QUICK_SEC)) awardHappiness(g, 'seated', HAPPINESS_POINTS.seated);
  const chair = g.seatId ? state.furniture.find((f) => f.id === g.seatId) : undefined;
  if (chair) {
    awardHappiness(g, 'comfort', seatComfort(state.furniture, chair));
    awardHappiness(g, 'music', auraPoints(state.furniture, chair, 'music'));
  }
  // Sitting down together as a couple, group or family (M12c).
  const bonus = g.partyId
    ? PARTY_KINDS[state.parties.find((p) => p.id === g.partyId)?.kind ?? 'solo'].bonus
    : null;
  if (bonus) awardHappiness(g, bonus, PARTY_BONUS_POINTS);
  beginStep(state, g);
}

/** The table a chair faces, if any. */
export function facedTable(
  furniture: readonly Furniture[],
  chair: Furniture,
): Furniture | undefined {
  const step = FACING_STEP[chairFacing(chair.rot)];
  const id = buildOccupancy(furniture).get(`${chair.x + step.x},${chair.y + step.y}`);
  const f = id ? furniture.find((o) => o.id === id) : undefined;
  return f && FURNITURE[f.defId].kind === 'table' ? f : undefined;
}

/** "Comfy seat": comfort of the chair plus comfort of the table it faces, at their levels. */
export function seatComfort(furniture: readonly Furniture[], chair: Furniture): number {
  const table = facedTable(furniture, chair);
  return comfortOf(chair) + (table ? comfortOf(table) : 0);
}

/** The waiter took the order; the next step is waiting for food. */
export function onOrderTaken(state: GameState, g: Guest): void {
  if (tookAtMost(state, g, ORDER_QUICK_SEC)) awardHappiness(g, 'order', HAPPINESS_POINTS.order);
  beginStep(state, g);
}

/** The dish arrived: food speed, dish quality and decor around the seat. */
export function onServed(state: GameState, g: Guest): void {
  if (tookAtMost(state, g, FOOD_QUICK_SEC)) awardHappiness(g, 'food', HAPPINESS_POINTS.food);
  if (g.recipeId) {
    awardHappiness(g, 'quality', qualityPoints(state.recipes[g.recipeId].level));
  }
  const chair = g.seatId ? state.furniture.find((f) => f.id === g.seatId) : undefined;
  if (chair) awardHappiness(g, 'decor', decorPoints(state.furniture, chair, state));
}

/** Points for a dish at the given recipe level. */
export function qualityPoints(level: number): number {
  return QUALITY_BASE + level * QUALITY_PER_LEVEL;
}

/** Chebyshev distance between a tile and the nearest tile of a furniture footprint. */
function tileDistance(f: Furniture, x: number, y: number): number {
  let best = Infinity;
  for (const t of footprintTiles(f.defId, f.x, f.y, f.rot)) {
    best = Math.min(best, Math.max(Math.abs(t.x - x), Math.abs(t.y - y)));
  }
  return best;
}

/**
 * Sum of the appeal of decor within the radius of the chair plus the floors and walls around it
 * (when the state is given), capped at DECOR_CAP.
 */
export function decorPoints(
  furniture: readonly Furniture[],
  chair: Furniture,
  surfaces?: Pick<GameState, 'grid' | 'room' | 'styles'>,
): number {
  let sum = surfaces ? surfacePoints(surfaces, chair) : 0;
  for (const f of furniture) {
    if (FURNITURE[f.defId].kind !== 'decor') continue;
    if (tileDistance(f, chair.x, chair.y) <= DECOR_RADIUS) sum += appealOf(f);
  }
  return Math.min(DECOR_CAP, sum);
}

export function fameFor(happiness: number): number {
  return Math.floor(happiness / FAME_DIVISOR);
}

export function tipFor(price: number, happiness: number): number {
  return Math.round((price * happiness) / TIP_DIVISOR);
}
