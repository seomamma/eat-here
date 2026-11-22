import { MAX_HEARTS, REGULAR_IDS, regularDef, type RegularId } from '../../data/regulars';
import { RANKS } from '../../data/ranks';
import { RECIPE_IDS, type RecipeId } from '../../data/recipes';
import type { IngredientId } from '../../data/ingredients';
import type { GameState } from '../state';
import { nextUpgrade } from './recipes';

/** What the player is working towards (pillar 5: always a next goal). Three slots, one each. */
export type Goal =
  | { id: string; kind: 'rank'; rank: number; fame: number; target: number; base: number }
  | {
      id: string;
      kind: 'upgrade';
      recipe: RecipeId;
      level: number;
      ingredient: IngredientId;
      haveIngredient: boolean;
      money: number;
      coins: number;
    }
  | { id: string; kind: 'hearts'; regular: RegularId; hearts: number; target: number }
  | {
      id: string;
      kind: 'hint';
      regular: RegularId;
      /** Progress towards the unlock condition, when it can be counted. */
      progress: { recipe: RecipeId; have: number; need: number; asLevel: boolean };
    }
  | { id: string; kind: 'done'; slot: 'rank' | 'upgrade' | 'regular' };

function rankGoal(state: GameState): Goal {
  const next = RANKS[state.rank];
  if (!next) return { id: 'done:rank', kind: 'done', slot: 'rank' };
  const base = RANKS[state.rank - 1]?.fame ?? 0;
  return {
    id: `rank:${next.rank}`,
    kind: 'rank',
    rank: next.rank,
    fame: state.fame,
    target: next.fame,
    base,
  };
}

/** The unlocked dish with the lowest level that can still be upgraded (first in menu order). */
function upgradeGoal(state: GameState): Goal {
  let best: { id: RecipeId; level: number } | null = null;
  for (const id of RECIPE_IDS) {
    const r = state.recipes[id];
    if (!r.unlocked || !nextUpgrade(id, r.level)) continue;
    if (!best || r.level < best.level) best = { id, level: r.level };
  }
  if (!best) return { id: 'done:upgrade', kind: 'done', slot: 'upgrade' };
  const up = nextUpgrade(best.id, best.level);
  if (!up) return { id: 'done:upgrade', kind: 'done', slot: 'upgrade' };
  return {
    id: `upgrade:${best.id}:${up.level}`,
    kind: 'upgrade',
    recipe: best.id,
    level: up.level,
    ingredient: up.ingredient,
    haveIngredient: (state.inventory[up.ingredient] ?? 0) > 0,
    money: state.money,
    coins: up.coins,
  };
}

/** A hint for the first regular not met yet; else the next friendship goal; else done. */
function regularGoal(state: GameState): Goal {
  for (const id of REGULAR_IDS) {
    if (state.regulars[id].unlocked) continue;
    const t = regularDef(id).unlock.trigger;
    const counted =
      t.kind === 'servedCount'
        ? { recipe: t.recipe, have: state.counters.served[t.recipe] ?? 0, need: t.count }
        : t.kind === 'servedLevel'
          ? { recipe: t.recipe, have: state.counters.servedLevel[t.recipe] ?? 0, need: t.level }
          : null;
    if (counted) {
      return {
        id: `hint:${id}`,
        kind: 'hint',
        regular: id,
        progress: { ...counted, asLevel: t.kind === 'servedLevel' },
      };
    }
  }
  for (const id of REGULAR_IDS) {
    const reg = state.regulars[id];
    if (!reg.unlocked || reg.hearts >= MAX_HEARTS) continue;
    const next =
      regularDef(id)
        .beats.map((b) => b.hearts)
        .find((h) => h > reg.hearts) ?? MAX_HEARTS;
    return {
      id: `hearts:${id}:${next}`,
      kind: 'hearts',
      regular: id,
      hearts: reg.hearts,
      target: next,
    };
  }
  return { id: 'done:regular', kind: 'done', slot: 'regular' };
}

/** The three goals shown in the Menu: rank, dish upgrade, regular. */
export function computeGoals(state: GameState): Goal[] {
  return [rankGoal(state), upgradeGoal(state), regularGoal(state)];
}
