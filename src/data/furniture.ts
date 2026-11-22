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
  /** Placeholder sprite color (main body), used until the art milestone. */
  color: number;
}

export const FURNITURE = {
  table_small: {
    name: 'Small Table',
    kind: 'table',
    footprint: [1, 1],
    price: 60,
    appeal: [2, 3, 5, 7, 10],
    useSpots: [],
    color: 0xb9824f,
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
    color: 0x8a5a34,
  },
  oven_pizza: {
    name: 'Pizza Oven',
    kind: 'oven',
    footprint: [2, 1],
    price: 400,
    appeal: [4, 6, 9, 13, 18],
    // Chef stands in front (below) the oven, facing it.
    useSpots: [{ dx: 0, dy: 1, facing: 'up' }],
    color: 0xb5473a,
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
    color: 0xe3d0ae,
  },
  plant_potted: {
    name: 'Potted Plant',
    kind: 'decor',
    footprint: [1, 1],
    price: 150,
    appeal: [5, 8, 12, 17, 25],
    useSpots: [],
    color: 0x3e7a3a,
  },
} satisfies Record<string, FurnitureDef>;

export type FurnitureDefId = keyof typeof FURNITURE;

export function getFurnitureDef(defId: FurnitureDefId): FurnitureDef {
  return FURNITURE[defId];
}
