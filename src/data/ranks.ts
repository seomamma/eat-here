/**
 * Restaurant ranks (GAME_DESIGN §9). Fame thresholds, unlocks and arrival-rate bonus per rank.
 * Thresholds are 3x the GAME_DESIGN draft: with ~25 guests/day at ~2.3 fame each the draft
 * 50 fame arrived at the end of day 1; 150 gives rank 2 on day 3 (measured in M6).
 */
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
}

export const RANKS: readonly RankDef[] = [
  { rank: 1, name: 'Hole in the Wall', fame: 0, recipes: [], perks: [], spawnRate: 1 },
  {
    rank: 2,
    name: 'Neighborhood Spot',
    fame: 150,
    recipes: ['pepperoni'],
    perks: ['More guests per day'],
    spawnRate: 1.15,
  },
  {
    rank: 3,
    name: 'Local Favorite',
    fame: 600,
    recipes: [],
    perks: ['New decor', 'More guests per day'],
    spawnRate: 1.3,
  },
  {
    rank: 4,
    name: 'Talk of the Town',
    fame: 1800,
    recipes: [],
    perks: ['Expansion', 'New guest type', 'More guests per day'],
    spawnRate: 1.5,
  },
  {
    rank: 5,
    name: 'City Classic',
    fame: 4500,
    recipes: [],
    perks: ['Regulars', 'More ovens', 'More guests per day'],
    spawnRate: 1.7,
  },
  {
    rank: 6,
    name: 'Legendary Pizzeria',
    fame: 12000,
    recipes: [],
    perks: ['Ending celebration'],
    spawnRate: 2,
  },
];

export function rankDef(rank: number): RankDef {
  const def = RANKS[rank - 1];
  if (!def) throw new Error(`unknown rank ${rank}`);
  return def;
}

export const MAX_RANK = RANKS.length;
