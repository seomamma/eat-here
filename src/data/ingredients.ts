/** Special upgrade ingredients (GAME_DESIGN §6, D-031). Collectibles, never used for daily cooking. */

export type Rarity = 'common' | 'rare';

export interface IngredientDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** One short line of flavour for the market and the recipe book. */
  flavour: string;
  /** Placeholder icon colour (CSS hex), used by the UI icons. */
  color: string;
}

export const INGREDIENTS = {
  oregano: {
    id: 'oregano',
    name: 'Oregano',
    rarity: 'common',
    flavour: 'Dried on the vine.',
    color: '#6f9a3a',
  },
  fresh_basil: {
    id: 'fresh_basil',
    name: 'Fresh Basil',
    rarity: 'common',
    flavour: 'Picked this morning.',
    color: '#3fa25b',
  },
  garlic_butter: {
    id: 'garlic_butter',
    name: 'Garlic Butter',
    rarity: 'common',
    flavour: 'Soft, golden, a bit loud.',
    color: '#f0d88a',
  },
  chili_flakes: {
    id: 'chili_flakes',
    name: 'Chili Flakes',
    rarity: 'common',
    flavour: 'A little kick.',
    color: '#d6382c',
  },
  san_marzano: {
    id: 'san_marzano',
    name: 'San Marzano Tomatoes',
    rarity: 'rare',
    flavour: 'Sweet, from the volcano slopes.',
    color: '#e2483d',
  },
  buffalo_mozzarella: {
    id: 'buffalo_mozzarella',
    name: 'Buffalo Mozzarella',
    rarity: 'rare',
    flavour: 'Creamy, still dripping.',
    color: '#f4efe4',
  },
  aged_parmesan: {
    id: 'aged_parmesan',
    name: 'Aged Parmesan',
    rarity: 'rare',
    flavour: 'Two years in the cellar.',
    color: '#e8b53a',
  },
  hot_honey: {
    id: 'hot_honey',
    name: 'Hot Honey',
    rarity: 'rare',
    flavour: 'Sweet first, then fire.',
    color: '#e58a1f',
  },
} satisfies Record<string, IngredientDef>;

export type IngredientId = keyof typeof INGREDIENTS;

/** Fixed iteration order (keeps seeded picks deterministic). */
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];
export const COMMON_INGREDIENTS = INGREDIENT_IDS.filter(
  (id) => INGREDIENTS[id].rarity === 'common',
);
export const RARE_INGREDIENTS = INGREDIENT_IDS.filter((id) => INGREDIENTS[id].rarity === 'rare');
