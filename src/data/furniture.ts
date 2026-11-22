export type FurnitureKind = 'table' | 'chair' | 'oven' | 'pass' | 'decor';
export type Facing = 'up' | 'down' | 'left' | 'right';

/** A tile (relative to the furniture origin) where a character stands/sits to use it. */
export interface UseSpot {
  dx: number;
  dy: number;
  facing: Facing;
}

export interface FurnitureDef {
  name: string;
  kind: FurnitureKind;
  /** Footprint [width, height] in tiles. */
  footprint: readonly [number, number];
  price: number;
  /** Appeal contributed per furniture level (index 0 = level 1). */
  appeal: readonly number[];
  useSpots: readonly UseSpot[];
  /**
   * Pixel position of the footprint's top corner (the projected tile origin) inside the
   * rot-0 sprite. The sprite is drawn with this point at the tile origin; rot 1 is the
   * same sprite mirrored around that point (ART_DIRECTION §2/§3).
   */
  spriteOrigin: readonly [number, number];
}

/** Orientation: 0 = as drawn, 1 = mirrored (footprint and use spots transposed). */
export type Rot = 0 | 1;

export const FURNITURE = {
  table_small: {
    name: 'Small Table',
    kind: 'table',
    footprint: [1, 1],
    price: 60,
    appeal: [2, 3, 5, 7, 10],
    useSpots: [],
    spriteOrigin: [16, 15],
  },
  chair_wood: {
    name: 'Wooden Chair',
    kind: 'chair',
    footprint: [1, 1],
    price: 25,
    appeal: [1, 2, 3, 4, 6],
    // The guest sits on the chair itself. Real facing (towards the table) is
    // derived from the neighbouring table when guests are added (M3).
    useSpots: [{ dx: 0, dy: 0, facing: 'down' }],
    spriteOrigin: [16, 19],
  },
  oven_pizza: {
    name: 'Pizza Oven',
    kind: 'oven',
    footprint: [2, 1],
    price: 400,
    appeal: [4, 6, 9, 13, 18],
    // Chef stands in front (below) the oven, facing it.
    useSpots: [{ dx: 0, dy: 1, facing: 'up' }],
    spriteOrigin: [16, 23],
  },
  counter_pass: {
    name: 'Pass Counter',
    kind: 'pass',
    footprint: [2, 1],
    price: 120,
    appeal: [1, 2, 3, 4, 6],
    // Chef side (above) and waiter side (below).
    useSpots: [
      { dx: 0, dy: -1, facing: 'down' },
      { dx: 0, dy: 1, facing: 'up' },
    ],
    spriteOrigin: [16, 15],
  },
  plant_potted: {
    name: 'Potted Plant',
    kind: 'decor',
    footprint: [1, 1],
    price: 150,
    appeal: [5, 8, 12, 17, 25],
    useSpots: [],
    spriteOrigin: [16, 23],
  },
} satisfies Record<string, FurnitureDef>;

export type FurnitureDefId = keyof typeof FURNITURE;

export function getFurnitureDef(defId: FurnitureDefId): FurnitureDef {
  return FURNITURE[defId];
}
