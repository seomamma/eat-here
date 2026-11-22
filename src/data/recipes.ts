/** Recipes (GAME_DESIGN §6). Prices and costs are abstract per-dish numbers. */
import type { IngredientId } from './ingredients';

export interface RecipeUpgrade {
  /** Level reached by this upgrade. */
  level: number;
  /** Special ingredient consumed (one). */
  ingredient: IngredientId;
  /** Coins paid. */
  coins: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  price: number;
  ingredientCost: number;
  cookTimeSec: number;
  /** 'start' = available from the beginning; otherwise the rank that unlocks it. */
  unlock: 'start' | { rank: number };
  /** Upgrades to Lv.2 and Lv.3 (MAX_RECIPE_LEVEL_MVP). */
  upgrades: readonly RecipeUpgrade[];
}

export const RECIPES = {
  marinara: {
    id: 'marinara',
    name: 'Marinara',
    price: 8,
    ingredientCost: 2,
    cookTimeSec: 6,
    unlock: 'start',
    upgrades: [
      { level: 2, ingredient: 'oregano', coins: 80 },
      { level: 3, ingredient: 'san_marzano', coins: 200 },
    ],
  },
  margherita: {
    id: 'margherita',
    name: 'Margherita',
    price: 10,
    ingredientCost: 3,
    cookTimeSec: 7,
    unlock: 'start',
    upgrades: [
      { level: 2, ingredient: 'fresh_basil', coins: 80 },
      { level: 3, ingredient: 'buffalo_mozzarella', coins: 200 },
    ],
  },
  garlic_bread: {
    id: 'garlic_bread',
    name: 'Garlic Bread',
    price: 6,
    ingredientCost: 1,
    cookTimeSec: 4,
    unlock: 'start',
    upgrades: [
      { level: 2, ingredient: 'garlic_butter', coins: 80 },
      { level: 3, ingredient: 'aged_parmesan', coins: 200 },
    ],
  },
  pepperoni: {
    id: 'pepperoni',
    name: 'Pepperoni',
    price: 13,
    ingredientCost: 4,
    cookTimeSec: 8,
    unlock: { rank: 2 },
    upgrades: [
      { level: 2, ingredient: 'chili_flakes', coins: 80 },
      { level: 3, ingredient: 'hot_honey', coins: 200 },
    ],
  },
} satisfies Record<string, RecipeDef>;

export type RecipeId = keyof typeof RECIPES;

/** Fixed iteration order (keeps seeded picks deterministic). */
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
