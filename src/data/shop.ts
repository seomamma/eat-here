import { FURNITURE, type FurnitureCategory, type FurnitureDefId } from './furniture';

/**
 * Furniture the player can buy, in shop order. The oven and the pass counter are part of the
 * kitchen the player starts with (upgraded, not bought); more kitchen gear comes later.
 */
export const SHOP_ITEMS: readonly FurnitureDefId[] = [
  'chair_wood',
  'table_small',
  'chair_cushion',
  'table_long',
  'vending_machine',
  'toilet',
  'piano',
  'plant_potted',
  'flower_box',
  'divider',
  'floor_lamp',
  'painting_easel',
  'pillar',
  'statue',
];

/** Category chips of the shop's Furniture tab, in order. */
export const SHOP_CATEGORIES: readonly FurnitureCategory[] = ['seating', 'fun', 'decor', 'kitchen'];

/** Shop items of one category. */
export function shopItemsOf(category: FurnitureCategory): FurnitureDefId[] {
  return SHOP_ITEMS.filter((id) => FURNITURE[id].category === category);
}

/** Rank a piece needs (1 = available from the start). */
export function unlockRank(defId: FurnitureDefId): number {
  const u = FURNITURE[defId].unlock;
  return u === 'start' ? 1 : u.rank;
}
