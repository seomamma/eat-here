/** Regulars (GAME_DESIGN "Regulars & Moments (M11 spec)"). Content and tuning only. */
import type { MomentCard, MomentReward, MomentTrigger } from './moments';
import type { RecipeId } from './recipes';

/** Look of a named guest; the view maps it to a palette and a small accessory. */
export type LookId = 'nonna_rosa' | 'oliver' | 'mia';

/** Visit windows as [from, to] minutes since midnight (the lunch and dinner peaks). */
export const VISIT_WINDOWS = {
  lunch: [720, 840],
  dinner: [1080, 1260],
} as const satisfies Record<string, readonly [number, number]>;
export type VisitWindow = keyof typeof VISIT_WINDOWS;

/** Heart limits and rules. */
export const MAX_HEARTS = 5;
/** A visit gives a heart when the regular pays with at least this happiness. */
export const HEART_MIN_HAPPINESS = 70;
/** Fame a regular gives on leaving is multiplied by this. */
export const REGULAR_FAME_MULT = 2;

export interface RegularBeat {
  hearts: number;
  card: MomentCard;
  reward?: MomentReward;
}

export interface CompanionDef {
  name: string;
  look: LookId;
  /** The companion comes along on visits once the regular has at least this many hearts. */
  minHearts: number;
  /** Chance (0..1) per such visit. */
  chance: number;
}

export interface RegularDef {
  id: string;
  name: string;
  look: LookId;
  favorite: RecipeId;
  /** What makes the regular appear; fires the "became a regular" moment. */
  unlock: { trigger: MomentTrigger; hint: string; card: MomentCard };
  /** Weekday indices (0 = Monday). */
  visitDays: readonly number[];
  visitWindow: VisitWindow;
  /** Seconds they wait for a free seat (guests of the Local type wait 30). */
  seatPatienceSec: number;
  beats: readonly RegularBeat[];
  companion?: CompanionDef;
}

export const REGULARS = {
  nonna_rosa: {
    id: 'nonna_rosa',
    name: 'Nonna Rosa',
    look: 'nonna_rosa',
    favorite: 'margherita',
    unlock: {
      trigger: { kind: 'servedLevel', recipe: 'margherita', level: 3 },
      hint: 'Someone in town dreams of a perfect Margherita…',
      card: {
        title: 'Nonna Rosa became a regular!',
        text: 'A perfect Margherita won her heart. She will drop by every Friday for lunch.',
        icon: 'nonna_rosa',
      },
    },
    visitDays: [4],
    visitWindow: 'lunch',
    seatPatienceSec: 90,
    beats: [
      {
        hearts: 2,
        card: {
          title: 'A gift from Nonna Rosa',
          text: 'Nonna Rosa brought you something from her secret pantry.',
          icon: 'basil',
        },
        reward: { ingredient: 'buffalo_mozzarella' },
      },
      {
        hearts: 4,
        card: {
          title: 'It tastes like Napoli',
          text: 'Nonna Rosa closed her eyes and said it tastes like Napoli. Word is spreading.',
          icon: 'star',
        },
        reward: { fame: 150 },
      },
    ],
  },
  oliver: {
    id: 'oliver',
    name: 'Oliver',
    look: 'oliver',
    favorite: 'pepperoni',
    unlock: {
      trigger: { kind: 'servedCount', recipe: 'pepperoni', count: 10 },
      hint: 'A pepperoni fan is keeping an eye on your menu…',
      card: {
        title: 'Oliver became a regular!',
        text: 'He loves your pepperoni. Look out for him on Tuesday evenings.',
        icon: 'oliver',
      },
    },
    visitDays: [1],
    visitWindow: 'dinner',
    seatPatienceSec: 90,
    beats: [
      {
        hearts: 2,
        card: {
          title: 'Hello, chef!',
          text: 'Oliver greeted the chef by name. The kitchen is blushing.',
          icon: 'heart',
        },
      },
      {
        hearts: 3,
        card: {
          title: 'Oliver brought a date!',
          text: 'Oliver mentioned someone special. Next time he may not come alone.',
          icon: 'mia',
        },
      },
      {
        hearts: 5,
        card: {
          title: 'A celebration',
          text: 'Oliver and Mia are celebrating something… and left a generous tip.',
          icon: 'heart',
        },
        reward: { coins: 120 },
      },
    ],
    companion: { name: 'Mia', look: 'mia', minHearts: 3, chance: 0.7 },
  },
} as const satisfies Record<string, RegularDef>;

export type RegularId = keyof typeof REGULARS;
/** Fixed iteration order (keeps everything deterministic). */
export const REGULAR_IDS = Object.keys(REGULARS) as RegularId[];

export function regularDef(id: RegularId): RegularDef {
  return REGULARS[id];
}
