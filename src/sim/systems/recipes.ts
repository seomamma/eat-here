import { MAX_RECIPE_LEVEL_MVP, PRICE_PER_LEVEL } from '../../data/balance';
import type { IngredientId } from '../../data/ingredients';
import { RECIPES, type RecipeId, type RecipeUpgrade } from '../../data/recipes';
import type { DayPhase } from '../time';

export type UpgradeReason =
  'notNow' | 'unknownRecipe' | 'locked' | 'maxLevel' | 'missingIngredient' | 'notEnoughMoney';
export type UpgradeResult = { ok: true } | { ok: false; reason: UpgradeReason };

/** The slice of state upgrade checks need (the UI mirrors the same fields). */
export interface UpgradeView {
  phase: DayPhase;
  money: number;
  inventory: Record<IngredientId, number>;
  recipes: Record<RecipeId, { unlocked: boolean; level: number }>;
}

/** Dish price at a recipe level: base * (1 + 0.15 * (level - 1)), rounded. */
export function priceAtLevel(recipeId: RecipeId, level: number): number {
  return Math.round(RECIPES[recipeId].price * (1 + PRICE_PER_LEVEL * (level - 1)));
}

/** The upgrade that takes the recipe from `level` to `level + 1`, or null at the MVP max. */
export function nextUpgrade(recipeId: RecipeId, level: number): RecipeUpgrade | null {
  if (level >= MAX_RECIPE_LEVEL_MVP) return null;
  return RECIPES[recipeId].upgrades.find((u) => u.level === level + 1) ?? null;
}

/** Why the recipe cannot be upgraded right now (first failing check), or ok. */
export function validateUpgrade(view: UpgradeView, recipeId: RecipeId): UpgradeResult {
  if (view.phase === 'night') return { ok: false, reason: 'notNow' };
  const recipe = view.recipes[recipeId] as { unlocked: boolean; level: number } | undefined;
  if (!recipe) return { ok: false, reason: 'unknownRecipe' };
  if (!recipe.unlocked) return { ok: false, reason: 'locked' };
  const up = nextUpgrade(recipeId, recipe.level);
  if (!up) return { ok: false, reason: 'maxLevel' };
  if ((view.inventory[up.ingredient] ?? 0) < 1) return { ok: false, reason: 'missingIngredient' };
  if (view.money < up.coins) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true };
}
