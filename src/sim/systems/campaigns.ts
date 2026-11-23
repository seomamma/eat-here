import {
  APPEAL_ARRIVAL_CAP,
  APPEAL_ARRIVAL_PER_POINT,
  CAMPAIGNS,
  type CampaignId,
} from '../../data/campaigns';
import { FURNITURE } from '../../data/furniture';
import { recordLedger } from '../dayStats';
import type { Emitter, GameEvents } from '../events';
import { rngInt } from '../rng';
import type { GameState } from '../state';
import { appealOf } from './facilities';

/** A scheduled lunch or dinner rush (radio campaign). */
export interface RushPlan {
  day: number;
  startMinute: number;
  endMinute: number;
  /** Minutes of day at which the remaining rush parties arrive (ascending). */
  pending: number[];
  /** True once `rushStarted` was announced. */
  announced: boolean;
}

/** The one running campaign. */
export interface CampaignState {
  id: CampaignId;
  startDay: number;
  /** Last day the campaign still counts (boost campaigns). */
  endDay: number;
  rush: RushPlan | null;
}

export type CampaignReason = 'notNow' | 'unknownCampaign' | 'locked' | 'busy' | 'notEnoughMoney';
export type CampaignResult = { ok: true } | { ok: false; reason: CampaignReason };

export function validateStartCampaign(state: GameState, id: CampaignId): CampaignResult {
  const def = CAMPAIGNS[id] as (typeof CAMPAIGNS)[CampaignId] | undefined;
  if (!def) return { ok: false, reason: 'unknownCampaign' };
  if (state.clock.phase === 'night' || state.clock.phase === 'report')
    return { ok: false, reason: 'notNow' };
  if (state.campaign) return { ok: false, reason: 'busy' };
  if (state.rank < def.rank) return { ok: false, reason: 'locked' };
  if (state.money < def.cost) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true };
}

/** The next rush start after "now": today's if still to come, else tomorrow's first. */
function nextRushStart(state: GameState, starts: readonly number[]): { day: number; minute: number } {
  const { day, minuteOfDay } = state.clock;
  const today = starts.find((m) => m > minuteOfDay);
  if (today !== undefined) return { day, minute: today };
  return { day: day + 1, minute: starts[0] ?? 0 };
}

/** Pays for the campaign and starts it; call `validateStartCampaign` first. */
export function startCampaign(state: GameState, events: Emitter<GameEvents>, id: CampaignId): void {
  const def = CAMPAIGNS[id];
  const { day } = state.clock;
  state.money -= def.cost;
  state.counters.campaigns++;
  recordLedger(state.dayStats, state.tick, 'ads', -def.cost, id);
  let campaign: CampaignState;
  if (def.effect.kind === 'boost') {
    campaign = { id, startDay: day, endDay: day + def.effect.days - 1, rush: null };
    // The first arrival after buying already feels the boost.
    state.guestSpawn.nextInTicks = Math.max(
      1,
      Math.ceil(state.guestSpawn.nextInTicks / def.effect.mult),
    );
  } else {
    const at = nextRushStart(state, def.effect.starts);
    const endMinute = at.minute + def.effect.windowMinutes;
    const pending: number[] = [];
    for (let i = 0; i < def.effect.parties; i++) {
      pending.push(rngInt(state, at.minute, endMinute - 5));
    }
    pending.sort((a, b) => a - b);
    campaign = {
      id,
      startDay: day,
      endDay: at.day,
      rush: { day: at.day, startMinute: at.minute, endMinute, pending, announced: false },
    };
  }
  state.campaign = campaign;
  events.emit('moneyChanged', { money: state.money });
  events.emit('campaignStarted', { id });
}

/** True while a radio rush is on (its hour of the day, with a campaign running). */
export function isRushActive(state: Pick<GameState, 'campaign' | 'clock'>): boolean {
  const r = state.campaign?.rush;
  if (!r || state.clock.day !== r.day) return false;
  return state.clock.minuteOfDay >= r.startMinute && state.clock.minuteOfDay < r.endMinute;
}

/** Arrival multiplier of the running boost campaign (1 when none). */
export function campaignMultiplier(state: Pick<GameState, 'campaign'>): number {
  const c = state.campaign;
  if (!c) return 1;
  const eff = CAMPAIGNS[c.id].effect;
  return eff.kind === 'boost' ? eff.mult : 1;
}

/** Curb appeal: the restaurant's decor makes people come in (small, capped). */
export function appealMultiplier(state: Pick<GameState, 'furniture'>): number {
  let points = 0;
  for (const f of state.furniture) if (FURNITURE[f.defId].kind === 'decor') points += appealOf(f);
  return 1 + Math.min(APPEAL_ARRIVAL_CAP, points * APPEAL_ARRIVAL_PER_POINT);
}

/** Ends campaigns whose days or rush have passed and announces a rush when its hour begins. */
export function tickCampaign(state: GameState, events: Emitter<GameEvents>): void {
  const c = state.campaign;
  if (!c) return;
  const { day, minuteOfDay } = state.clock;
  const r = c.rush;
  if (r) {
    if (day > r.day || (day === r.day && minuteOfDay >= r.endMinute)) {
      state.campaign = null;
      events.emit('campaignEnded', { id: c.id });
    } else if (!r.announced && day === r.day && minuteOfDay >= r.startMinute) {
      r.announced = true;
      events.emit('rushStarted', { day });
    }
    return;
  }
  if (day > c.endDay) {
    state.campaign = null;
    events.emit('campaignEnded', { id: c.id });
  }
}
