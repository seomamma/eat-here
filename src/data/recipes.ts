/** Recipes (GAME_DESIGN §6). Prices and costs are abstract per-dish numbers. */
import type { IngredientId } from './ingredients';

export interface RecipeUpgrade {
  /** Level reached by this upgrade. */
  level: number;
  /** Special ingredient consumed (one); null = coins only (Lv.2-3). */
  ingredient: IngredientId | null;
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
  /** Upgrades to Lv.2 .. MAX_RECIPE_LEVEL (D-036). */
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
      { level: 2, ingredient: null, coins: 60 },
      { level: 3, ingredient: null, coins: 150 },
      { level: 4, ingredient: 'san_marzano', coins: 300 },
      { level: 5, ingredient: 'sicilian_oregano', coins: 500 },
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
      { level: 2, ingredient: null, coins: 60 },
      { level: 3, ingredient: null, coins: 150 },
      { level: 4, ingredient: 'buffalo_mozzarella', coins: 300 },
      { level: 5, ingredient: 'nonnas_secret_basil', coins: 500 },
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
      { level: 2, ingredient: null, coins: 60 },
      { level: 3, ingredient: null, coins: 150 },
      { level: 4, ingredient: 'aged_parmesan', coins: 300 },
      { level: 5, ingredient: 'black_garlic', coins: 500 },
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
      { level: 2, ingredient: null, coins: 60 },
      { level: 3, ingredient: null, coins: 150 },
      { level: 4, ingredient: 'hot_honey', coins: 300 },
      { level: 5, ingredient: 'calabrian_chili', coins: 500 },
    ],
  },
} satisfies Record<string, RecipeDef>;

export type RecipeId = keyof typeof RECIPES;

/** Fixed iteration order (keeps seeded picks deterministic). */
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
