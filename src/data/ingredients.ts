/** Special upgrade ingredients (GAME_DESIGN §6, D-031, D-036). Collectibles, never used for daily cooking. */

/**
 * `rare` ingredients come from the market, gifts and rank rewards; `exclusive` ones only from
 * story beats (D-036) and are never sold or gifted.
 */
export type Rarity = 'rare' | 'exclusive';

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
  sicilian_oregano: {
    id: 'sicilian_oregano',
    name: 'Sicilian Oregano',
    rarity: 'rare',
    flavour: 'Dried in the sun on the cliffs.',
    color: '#6f9a3a',
  },
  black_garlic: {
    id: 'black_garlic',
    name: 'Black Garlic',
    rarity: 'rare',
    flavour: 'Sweet, dark and slow.',
    color: '#4a3a4f',
  },
  calabrian_chili: {
    id: 'calabrian_chili',
    name: 'Calabrian Chili',
    rarity: 'rare',
    flavour: 'Smoky, with a long fire.',
    color: '#d6382c',
  },
  nonnas_secret_basil: {
    id: 'nonnas_secret_basil',
    name: "Nonna's Secret Basil",
    rarity: 'exclusive',
    flavour: 'Grown on a windowsill in Napoli.',
    color: '#3fa25b',
  },
} satisfies Record<string, IngredientDef>;

export type IngredientId = keyof typeof INGREDIENTS;

/** Fixed iteration order (keeps seeded picks deterministic). */
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];
/** The pool the market and gifts draw from (never exclusive ingredients). */
export const RARE_INGREDIENTS = INGREDIENT_IDS.filter((id) => INGREDIENTS[id].rarity === 'rare');
