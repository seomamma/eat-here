/** Recipes (GAME_DESIGN §6). Prices and costs are abstract per-dish numbers. */

export interface RecipeDef {
  id: string;
  name: string;
  price: number;
  ingredientCost: number;
  cookTimeSec: number;
  /** 'start' = available from the beginning; otherwise the rank that unlocks it. */
  unlock: 'start' | { rank: number };
}

export const RECIPES = {
  marinara: {
    id: 'marinara',
    name: 'Marinara',
    price: 8,
    ingredientCost: 2,
    cookTimeSec: 6,
    unlock: 'start',
  },
  margherita: {
    id: 'margherita',
    name: 'Margherita',
    price: 10,
    ingredientCost: 3,
    cookTimeSec: 7,
    unlock: 'start',
  },
  garlic_bread: {
    id: 'garlic_bread',
    name: 'Garlic Bread',
    price: 6,
    ingredientCost: 1,
    cookTimeSec: 4,
    unlock: 'start',
  },
  pepperoni: {
    id: 'pepperoni',
    name: 'Pepperoni',
    price: 13,
    ingredientCost: 4,
    cookTimeSec: 8,
    unlock: { rank: 2 },
  },
} satisfies Record<string, RecipeDef>;

export type RecipeId = keyof typeof RECIPES;

/** Fixed iteration order (keeps seeded picks deterministic). */
export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
