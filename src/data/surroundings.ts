/**
 * Outdoor area around the building (M11b). View-only decoration: it is not part of the sim grid
 * or pathfinding. Tile coordinates are the sim grid's (x to the lower-right, y to the lower-left)
 * and may lie outside the grid: x < 0 / y < 0 is behind the back walls, y >= GRID_HEIGHT is the
 * door side (sidewalk, then street), x >= GRID_WIDTH is beside the low cut-away wall.
 */
import { GRID_HEIGHT, GRID_WIDTH } from './layout';

export type GroundKind = 'grass' | 'soil' | 'sidewalk' | 'asphalt' | 'asphalt_line';

export type PropKind =
  | 'tree_round'
  | 'tree_tall'
  | 'bush'
  | 'bush_flowers'
  | 'flower_red'
  | 'flower_yellow'
  | 'flower_white'
  | 'lamp'
  | 'bench';

export interface SurroundingProp {
  kind: PropKind;
  /** Tile the prop stands on (a bench covers this tile and the next one along x). */
  x: number;
  y: number;
}

/** Widths in tiles of the ring around the building's footprint. */
export const SURROUNDINGS = {
  /** Grass/soil beyond the back-right wall (y < 0), the back-left wall (x < 0) and the right side. */
  back: 4,
  left: 4,
  right: 4,
  /** Door side, from the building outwards: sidewalk, street (centre row has the dashed line), grass. */
  sidewalk: 1,
  street: 3,
  farSide: 2,
  /** The street and sidewalk run this many tiles further than the grass ring on both ends. */
  roadExtra: 12,
  /** Soil strip (tiles) right around the building's back and sides; grass beyond. */
  soilBand: 2,
  /** Extra screen px (art pixels) the camera may pan beyond the room: left, right, top, bottom. */
  cameraMarginPx: { left: 96, right: 96, top: 72, bottom: 104 },
} as const;

/** Tile rectangle [x0, x1] x [y0, y1] (inclusive) that holds ground, without the road extension. */
export function groundRect(): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: -SURROUNDINGS.left,
    x1: GRID_WIDTH - 1 + SURROUNDINGS.right,
    y0: -SURROUNDINGS.back,
    y1: GRID_HEIGHT - 1 + SURROUNDINGS.sidewalk + SURROUNDINGS.street + SURROUNDINGS.farSide,
  };
}

/** True for tiles that lie inside the room (floor under the building's walls). */
export function isRoomTile(x: number, y: number): boolean {
  return x >= 1 && x <= GRID_WIDTH - 2 && y >= 1 && y <= GRID_HEIGHT - 1;
}

/** First and last row of the sidewalk / street on the door side. */
const SIDEWALK_Y = GRID_HEIGHT;
const STREET_Y = SIDEWALK_Y + SURROUNDINGS.sidewalk;
const STREET_CENTRE_Y = STREET_Y + Math.floor(SURROUNDINGS.street / 2);
const STREET_END_Y = STREET_Y + SURROUNDINGS.street - 1;

/** What the ground at a tile is, or null when nothing is drawn there (inside the room, or off the map). */
export function groundKind(x: number, y: number): GroundKind | null {
  if (isRoomTile(x, y)) return null;
  const { x0, x1, y0, y1 } = groundRect();
  const extra = SURROUNDINGS.roadExtra;
  if (y >= SIDEWALK_Y && y < SIDEWALK_Y + SURROUNDINGS.sidewalk) {
    return x >= x0 - extra && x <= x1 + extra ? 'sidewalk' : null;
  }
  if (y >= STREET_Y && y <= STREET_END_Y) {
    if (x < x0 - extra || x > x1 + extra) return null;
    return y === STREET_CENTRE_Y ? 'asphalt_line' : 'asphalt';
  }
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  // Soil right around the building (not on the door side), grass further out.
  const dx = Math.max(1 - x, x - (GRID_WIDTH - 2), 0);
  const dy = Math.max(1 - y, 0);
  return y < SIDEWALK_Y && Math.max(dx, dy) <= SURROUNDINGS.soilBand ? 'soil' : 'grass';
}

/** Hand-placed props. Keep trees at least 2 tiles away from the walls so crowns only peek over. */
export const SURROUNDING_PROPS: readonly SurroundingProp[] = [
  // Back-left side: trees behind the left wall, bushes and flowers in the grass.
  { kind: 'tree_round', x: -2, y: 3 },
  { kind: 'tree_tall', x: -3, y: 8 },
  { kind: 'tree_round', x: -2, y: 11 },
  { kind: 'bush', x: -1, y: 6 },
  { kind: 'bush_flowers', x: -1, y: 9 },
  { kind: 'flower_red', x: -3, y: 5 },
  { kind: 'flower_yellow', x: -2, y: 6 },
  { kind: 'flower_white', x: -4, y: 10 },
  { kind: 'flower_red', x: -3, y: 12 },
  // Back-right side.
  { kind: 'tree_tall', x: 2, y: -3 },
  { kind: 'tree_round', x: 7, y: -2 },
  { kind: 'bush', x: 4, y: -1 },
  { kind: 'bush_flowers', x: 9, y: -1 },
  { kind: 'flower_yellow', x: 5, y: -3 },
  { kind: 'flower_white', x: 9, y: -3 },
  { kind: 'flower_red', x: 1, y: -2 },
  // Right side (beside the low wall): a hedge in the soil strip, trees further out.
  { kind: 'bush', x: 10, y: 3 },
  { kind: 'bush_flowers', x: 10, y: 5 },
  { kind: 'bush', x: 10, y: 7 },
  { kind: 'bush', x: 10, y: 10 },
  { kind: 'tree_tall', x: 12, y: 1 },
  { kind: 'tree_round', x: 12, y: 8 },
  { kind: 'flower_red', x: 11, y: 4 },
  { kind: 'flower_yellow', x: 11, y: 9 },
  { kind: 'flower_white', x: 13, y: 5 },
  // Door side: lamp posts and a bench on the sidewalk (the door gap at DOOR_X stays clear).
  { kind: 'lamp', x: 2, y: 12 },
  { kind: 'bench', x: 6, y: 12 },
  { kind: 'lamp', x: 9, y: 12 },
  { kind: 'lamp', x: -3, y: 12 },
  // Grass strip across the street.
  { kind: 'bush', x: 1, y: 17 },
  { kind: 'bush_flowers', x: 5, y: 17 },
  { kind: 'tree_round', x: 8, y: 17 },
  { kind: 'flower_red', x: 3, y: 16 },
  { kind: 'flower_yellow', x: 7, y: 16 },
  { kind: 'flower_white', x: 10, y: 16 },
];
