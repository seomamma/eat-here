/**
 * Moments (M11): one-off celebratory cards with an optional reward. Regular unlocks and story
 * beats are generated from `regulars.ts`; later content (magazine, awards, events) adds entries.
 */
import type { IngredientId } from './ingredients';
import type { RecipeId } from './recipes';
import { REGULAR_IDS, REGULARS, type LookId, type RegularId } from './regulars';

/** Icon ids the moment card UI can draw. */
export type MomentIcon = LookId | 'heart' | 'basil' | 'star';

export interface MomentCard {
  title: string;
  text: string;
  icon: MomentIcon;
}

/** What a moment gives. `unlockRegular` is a unlock, not a prize. */
export interface MomentReward {
  coins?: number;
  ingredient?: IngredientId;
  fame?: number;
  unlockRegular?: RegularId;
}

/** Conditions on state (evaluated by systems/moments.ts). */
export type MomentTrigger =
  /** At least `count` dishes of the recipe were served in total. */
  | { kind: 'servedCount'; recipe: RecipeId; count: number }
  /** A dish of the recipe was served while it was at least this level. */
  | { kind: 'servedLevel'; recipe: RecipeId; level: number }
  /** The regular has at least this many hearts. */
  | { kind: 'hearts'; regular: RegularId; hearts: number }
  /** The recipe reached at least this level. */
  | { kind: 'recipeLevel'; recipe: RecipeId; level: number }
  | { kind: 'rank'; rank: number }
  | { kind: 'day'; day: number };

export interface MomentDef {
  id: string;
  trigger: MomentTrigger;
  card: MomentCard;
  reward?: MomentReward;
}

/** Moments that are not tied to a regular. */
const STANDALONE: readonly MomentDef[] = [];

function regularMoments(): MomentDef[] {
  const out: MomentDef[] = [];
  for (const id of REGULAR_IDS) {
    const r = REGULARS[id];
    out.push({
      id: `regular_${id}`,
      trigger: r.unlock.trigger,
      card: r.unlock.card,
      reward: { unlockRegular: id },
    });
    for (const beat of r.beats) {
      const def: MomentDef = {
        id: `${id}_h${beat.hearts}`,
        trigger: { kind: 'hearts', regular: id, hearts: beat.hearts },
        card: beat.card,
      };
      const reward = (beat as { reward?: MomentReward }).reward;
      if (reward) def.reward = reward;
      out.push(def);
    }
  }
  return out;
}

/** Every moment, in evaluation order. */
export const MOMENTS: readonly MomentDef[] = [...regularMoments(), ...STANDALONE];

/** Id of the "became a regular" moment. */
export function unlockMomentId(id: RegularId): string {
  return `regular_${id}`;
}
