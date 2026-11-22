import { RECIPE_IDS, type RecipeId } from '../data/recipes';

export interface DayStats {
  /** Money received from guests (dish prices plus tips). */
  income: number;
  tips: number;
  fameGained: number;
  ingredientCosts: number;
  guestsServed: number;
  guestsLeftNoSeat: number;
  /** Ingredient gifts received from guests today. */
  gifts: number;
  /** Dishes sold (paid) today, per recipe. */
  ordersByRecipe: Partial<Record<RecipeId, number>>;
}

export function createDayStats(): DayStats {
  return {
    income: 0,
    tips: 0,
    fameGained: 0,
    ingredientCosts: 0,
    guestsServed: 0,
    guestsLeftNoSeat: 0,
    gifts: 0,
    ordersByRecipe: {},
  };
}

export function profitOf(stats: DayStats): number {
  return stats.income - stats.ingredientCosts;
}

/** Most sold recipe of the day (first in recipe order on ties), or null when nothing sold. */
export function bestSeller(stats: DayStats): RecipeId | null {
  let best: RecipeId | null = null;
  let bestN = 0;
  for (const id of RECIPE_IDS) {
    const n = stats.ordersByRecipe[id] ?? 0;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}
