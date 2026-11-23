/**
 * Advertising (M12c, D-042). One campaign at a time. `boost` campaigns raise the arrival rate
 * for a number of days; the radio spot schedules a lunch or dinner rush instead.
 */
export type CampaignId = 'flyers' | 'poster' | 'radio';

export interface CampaignDef {
  id: CampaignId;
  /** Rank that unlocks it. */
  rank: number;
  cost: number;
  effect:
    | {
        kind: 'boost';
        /** Arrival rate multiplier while active. */
        mult: number;
        /** Days it lasts, counting the day it is started (1 = the rest of today). */
        days: number;
      }
    | {
        kind: 'rush';
        /** Parties that show up in the rush (on top of the normal arrivals). */
        parties: number;
        /** Length of the rush in in-game minutes. */
        windowMinutes: number;
        /** Minutes since midnight at which a rush can start (the next one after the purchase). */
        starts: readonly number[];
      };
}

export const CAMPAIGN_IDS: readonly CampaignId[] = ['flyers', 'poster', 'radio'];

export const CAMPAIGNS: Record<CampaignId, CampaignDef> = {
  flyers: { id: 'flyers', rank: 1, cost: 30, effect: { kind: 'boost', mult: 1.4, days: 1 } },
  poster: { id: 'poster', rank: 2, cost: 100, effect: { kind: 'boost', mult: 1.6, days: 2 } },
  radio: {
    id: 'radio',
    rank: 3,
    cost: 260,
    effect: { kind: 'rush', parties: 6, windowMinutes: 60, starts: [720, 1080] },
  },
};

/** Total decor appeal adds this much to the arrival rate per point, up to the cap (curb appeal). */
export const APPEAL_ARRIVAL_PER_POINT = 0.004;
export const APPEAL_ARRIVAL_CAP = 0.3;
