/** What a piece does in the sim. Fun items that only look nice (piano) are `decor` plus an aura. */
export type FurnitureKind = 'table' | 'chair' | 'oven' | 'pass' | 'decor' | 'vending' | 'toilet';
/** Shop grouping (M12). */
export type FurnitureCategory = 'seating' | 'fun' | 'decor' | 'kitchen';
/** Furniture levels (M12): every piece goes Lv.1 to Lv.5. */
export const MAX_FURNITURE_LEVEL = 5;
/** When a piece becomes available in the shop: from the start or at a rank. */
export type FurnitureUnlock = 'start' | { rank: number };
/** Happiness reasons furniture can add (the sim's HappinessReason includes these). */
export type FurnitureReason = 'comfort' | 'music' | 'toilet' | 'snack';

/** A guest walks to the piece and uses it for a few seconds (vending machine, toilet). */
export interface Interaction {
  kind: 'vending' | 'toilet';
  /** Chance (0..1) that a guest who could use it does. Vending: guests waiting for a seat. Toilet: after eating. */
  chance: number;
  /** Seconds the guest spends at the piece. */
  useSec: number;
  /** Happiness points per level (index 0 = Lv.1) given when the use is finished. */
  points: readonly number[];
  reason: FurnitureReason;
  /** Coins paid per use per level (vending). */
  coins?: readonly number[];
}

/** A happiness aura: guests seated within `radius` tiles of the piece get points per level. */
export interface Aura {
  radius: number;
  points: readonly number[];
  reason: FurnitureReason;
}

/** Number of upgrade steps (Lv.1 to Lv.5). */
export type LevelUpCosts = readonly [number, number, number, number];
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
  category: FurnitureCategory;
  price: number;
  /** Shop availability; pieces the player cannot buy are not in `SHOP_ITEMS`. */
  unlock: FurnitureUnlock;
  /** Decor appeal per furniture level (index 0 = level 1); counted for `decor` pieces only. */
  appeal: readonly number[];
  /** Coins to go from level n to n + 1 (index 0 = Lv.1 to Lv.2). */
  levelUpCost: LevelUpCosts;
  /** "Comfy seat" points per level for chairs and tables a guest sits at. */
  comfort?: readonly number[];
  aura?: Aura;
  interaction?: Interaction;
  /** A seat only kids use (the high chair, M12c); kids can sit on any other chair too. */
  kidsOnly?: boolean;
  /** Work-time multiplier per level (oven: cook time, pass: placing and picking up dishes). */
  speed?: readonly number[];
  useSpots: readonly UseSpot[];
  /**
   * Pixel position of the footprint's top corner (the projected tile origin) inside the
   * rot-0 sprite. The sprite is drawn with this point at the tile origin; rot 1 is the
   * same sprite mirrored around that point (ART_DIRECTION §2/§3).
   */
  spriteOrigin: readonly [number, number];
}

/**
 * Orientation (D-030): 0 = front view as drawn, 1 = front mirrored (footprint and use spots
 * transposed), 2 = back view (turned 180 degrees), 3 = back view mirrored.
 */
export type Rot = 0 | 1 | 2 | 3;

const DEFS = {
  // ---- Seating -------------------------------------------------------------------------
  chair_wood: {
    name: 'Wooden Chair',
    kind: 'chair',
    category: 'seating',
    footprint: [1, 1],
    price: 25,
    unlock: 'start',
    appeal: [1, 2, 3, 4, 6],
    levelUpCost: [15, 30, 55, 90],
    comfort: [0, 1, 2, 3, 4],
    // The guest sits on the chair itself, facing the chair's direction (rot 0 = down).
    useSpots: [{ dx: 0, dy: 0, facing: 'down' }],
    spriteOrigin: [16, 19],
  },
  chair_cushion: {
    name: 'Cushioned Chair',
    kind: 'chair',
    category: 'seating',
    footprint: [1, 1],
    price: 80,
    unlock: { rank: 2 },
    appeal: [2, 3, 4, 6, 8],
    levelUpCost: [40, 80, 140, 230],
    comfort: [3, 4, 5, 6, 8],
    useSpots: [{ dx: 0, dy: 0, facing: 'down' }],
    spriteOrigin: [16, 19],
  },
  chair_high: {
    name: 'High Chair',
    kind: 'chair',
    category: 'seating',
    footprint: [1, 1],
    price: 35,
    unlock: { rank: 2 },
    appeal: [1, 2, 3, 4, 5],
    levelUpCost: [18, 36, 65, 105],
    comfort: [1, 2, 3, 4, 5],
    kidsOnly: true,
    useSpots: [{ dx: 0, dy: 0, facing: 'down' }],
    spriteOrigin: [16, 19],
  },
  table_small: {
    name: 'Small Table',
    kind: 'table',
    category: 'seating',
    footprint: [1, 1],
    price: 60,
    unlock: 'start',
    appeal: [2, 3, 5, 7, 10],
    levelUpCost: [30, 60, 105, 170],
    comfort: [0, 1, 2, 3, 4],
    useSpots: [],
    spriteOrigin: [16, 15],
  },
  table_long: {
    name: 'Long Table',
    kind: 'table',
    category: 'seating',
    footprint: [2, 1],
    price: 100,
    unlock: { rank: 2 },
    appeal: [3, 4, 6, 8, 12],
    levelUpCost: [70, 140, 250, 400],
    comfort: [1, 2, 3, 5, 6],
    useSpots: [],
    spriteOrigin: [16, 15],
  },
  // ---- Fun -----------------------------------------------------------------------------
  vending_machine: {
    name: 'Vending Machine',
    kind: 'vending',
    category: 'fun',
    footprint: [1, 1],
    price: 320,
    unlock: { rank: 3 },
    appeal: [1, 2, 3, 4, 5],
    levelUpCost: [160, 320, 560, 900],
    interaction: {
      kind: 'vending',
      chance: 0.7,
      useSec: 3,
      points: [5, 5, 6, 6, 7],
      reason: 'snack',
      coins: [3, 4, 5, 7, 9],
    },
    // The guest stands in front (below), facing the machine.
    useSpots: [{ dx: 0, dy: 1, facing: 'up' }],
    spriteOrigin: [16, 29],
  },
  piano: {
    name: 'Piano',
    kind: 'decor',
    category: 'fun',
    footprint: [2, 1],
    price: 650,
    unlock: { rank: 4 },
    appeal: [3, 4, 6, 8, 10],
    levelUpCost: [325, 650, 1100, 1750],
    aura: { radius: 3, points: [4, 6, 8, 10, 12], reason: 'music' },
    useSpots: [],
    spriteOrigin: [16, 23],
  },
  toilet: {
    name: 'Toilet',
    kind: 'toilet',
    category: 'fun',
    footprint: [1, 1],
    price: 260,
    unlock: { rank: 2 },
    appeal: [1, 2, 3, 4, 5],
    levelUpCost: [130, 260, 450, 730],
    interaction: {
      kind: 'toilet',
      chance: 0.35,
      useSec: 4,
      points: [6, 8, 10, 12, 14],
      reason: 'toilet',
    },
    useSpots: [{ dx: 0, dy: 1, facing: 'up' }],
    spriteOrigin: [16, 27],
  },
  // ---- Decor ---------------------------------------------------------------------------
  plant_potted: {
    name: 'Potted Plant',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 150,
    unlock: 'start',
    appeal: [5, 8, 12, 17, 25],
    levelUpCost: [75, 150, 260, 420],
    useSpots: [],
    spriteOrigin: [16, 23],
  },
  flower_box: {
    name: 'Flower Box',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 70,
    unlock: { rank: 2 },
    appeal: [2, 3, 5, 7, 10],
    levelUpCost: [35, 70, 120, 200],
    useSpots: [],
    spriteOrigin: [16, 13],
  },
  divider: {
    name: 'Low Divider',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 40,
    unlock: { rank: 3 },
    appeal: [1, 2, 3, 4, 5],
    levelUpCost: [20, 40, 70, 115],
    useSpots: [],
    spriteOrigin: [16, 17],
  },
  floor_lamp: {
    name: 'Floor Lamp',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 110,
    unlock: { rank: 2 },
    appeal: [3, 5, 7, 10, 14],
    levelUpCost: [55, 110, 190, 310],
    useSpots: [],
    spriteOrigin: [16, 29],
  },
  painting_easel: {
    name: 'Painting on Easel',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 180,
    unlock: { rank: 3 },
    appeal: [4, 6, 9, 13, 18],
    levelUpCost: [90, 180, 310, 500],
    useSpots: [],
    spriteOrigin: [16, 27],
  },
  pillar: {
    name: 'Pillar',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 90,
    unlock: { rank: 4 },
    appeal: [2, 3, 4, 6, 8],
    levelUpCost: [45, 90, 160, 260],
    useSpots: [],
    spriteOrigin: [16, 39],
  },
  statue: {
    name: 'Marble Statue',
    kind: 'decor',
    category: 'decor',
    footprint: [1, 1],
    price: 420,
    unlock: { rank: 4 },
    appeal: [8, 12, 17, 23, 30],
    levelUpCost: [210, 420, 730, 1150],
    useSpots: [],
    spriteOrigin: [16, 37],
  },
  // ---- Kitchen -------------------------------------------------------------------------
  oven_pizza: {
    name: 'Pizza Oven',
    kind: 'oven',
    category: 'kitchen',
    footprint: [2, 1],
    price: 400,
    unlock: 'start',
    appeal: [4, 6, 9, 13, 18],
    levelUpCost: [150, 300, 520, 850],
    speed: [1, 0.9, 0.8, 0.7, 0.6],
    // Chef stands in front (below) the oven, facing it.
    useSpots: [{ dx: 0, dy: 1, facing: 'up' }],
    spriteOrigin: [16, 23],
  },
  counter_pass: {
    name: 'Pass Counter',
    kind: 'pass',
    category: 'kitchen',
    footprint: [2, 1],
    price: 120,
    unlock: 'start',
    appeal: [1, 2, 3, 4, 6],
    levelUpCost: [60, 120, 210, 340],
    speed: [1, 0.92, 0.84, 0.76, 0.68],
    // Chef side (above) and waiter side (below).
    useSpots: [
      { dx: 0, dy: -1, facing: 'down' },
      { dx: 0, dy: 1, facing: 'up' },
    ],
    spriteOrigin: [16, 15],
  },
} satisfies Record<string, FurnitureDef>;

export type FurnitureDefId = keyof typeof DEFS;

/** Every piece by id; typed as the general def so optional fields (comfort, aura...) read cleanly. */
export const FURNITURE: Record<FurnitureDefId, FurnitureDef> = DEFS;

export function getFurnitureDef(defId: FurnitureDefId): FurnitureDef {
  return FURNITURE[defId];
}
