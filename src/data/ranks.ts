/**
 * Restaurant ranks (GAME_DESIGN §9). Fame thresholds, unlocks and arrival-rate bonus per rank.
 * Thresholds are 7x the GAME_DESIGN draft (D-028): happiness scale was raised, so fame per
 * guest is higher. Rank 2 is 500 (D-034): the scripted player of `npm run balance` reaches it on
 * day 4 (day 3 on one seed of ten).
 */
import type { IngredientId } from './ingredients';
import type { RecipeId } from './recipes';

export interface RankDef {
  /** 1-based rank number. */
  rank: number;
  name: string;
  /** Total fame needed to reach this rank. */
  fame: number;
  /** Recipes that become available (unlocked) on reaching the rank. */
  recipes: readonly RecipeId[];
  /** Other unlocks, shown in the RANK UP modal (not wired up yet). */
  perks: readonly string[];
  /** Guest arrival rate multiplier (1 = base curve). */
  spawnRate: number;
  /** Special ingredient handed out on reaching the rank (D-031). */
  reward: IngredientId | null;
}

export const RANKS: readonly RankDef[] = [
  {
    rank: 1,
    name: 'Hole in the Wall',
    fame: 0,
    recipes: [],
    perks: [],
    spawnRate: 1,
    reward: null,
  },
  {
    rank: 2,
    name: 'Neighborhood Spot',
    fame: 500,
    recipes: ['pepperoni'],
    perks: ['More guests per day'],
    spawnRate: 1.05,
    reward: 'buffalo_mozzarella',
  },
  {
    rank: 3,
    name: 'Local Favorite',
    fame: 1400,
    recipes: [],
    perks: ['New decor', 'More guests per day'],
    spawnRate: 1.15,
    reward: 'hot_honey',
  },
  {
    rank: 4,
    name: 'Talk of the Town',
    fame: 4200,
    recipes: [],
    perks: ['Expansion', 'New guest type', 'More guests per day'],
    spawnRate: 1.5,
    reward: 'aged_parmesan',
  },
  {
    rank: 5,
    name: 'City Classic',
    fame: 10500,
    recipes: [],
    perks: ['Regulars', 'More ovens', 'More guests per day'],
    spawnRate: 1.7,
    reward: 'san_marzano',
  },
  {
    rank: 6,
    name: 'Legendary Pizzeria',
    fame: 28000,
    recipes: [],
    perks: ['Ending celebration'],
    spawnRate: 2,
    reward: 'buffalo_mozzarella',
  },
];

export function rankDef(rank: number): RankDef {
  const def = RANKS[rank - 1];
  if (!def) throw new Error(`unknown rank ${rank}`);
  return def;
}

export const MAX_RANK = RANKS.length;
