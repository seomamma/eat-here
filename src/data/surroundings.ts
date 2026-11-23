/**
 * Outdoor area around the building (M11b). View-only decoration: it is not part of the sim grid
 * or pathfinding. Tile coordinates are the sim grid's (x to the lower-right, y to the lower-left).
 * Everything is computed around the current room rectangle (M12b): behind the back walls
 * (x < x0 / y < y0), beside the low cut-away wall (x > x1) and on the door side (y > y1: sidewalk,
 * then street, which stay in front of the door edge). When the room grows the ring is laid out
 * again; ground and props depend only on absolute tile coordinates and the room, so what stays
 * outside keeps its look.
 */
import { DOOR_X, SIDEWALK_Y, type Room } from './layout';

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

/**
 * Tile rectangle [x0, x1] x [y0, y1] (inclusive) that holds ground, without the road extension.
 * The ring is measured from the walls' footprint (one tile outside the room).
 */
export function groundRect(room: Readonly<Room>): {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} {
  return {
    x0: room.x0 - 1 - SURROUNDINGS.left,
    x1: room.x1 + 1 + SURROUNDINGS.right,
    y0: room.y0 - 1 - SURROUNDINGS.back,
    y1: room.y1 + SURROUNDINGS.sidewalk + SURROUNDINGS.street + SURROUNDINGS.farSide,
  };
}

/** True for tiles that lie inside the room (floor under the building's walls). */
export function isRoomTile(room: Readonly<Room>, x: number, y: number): boolean {
  return x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1;
}

/** First and last row of the sidewalk / street on the door side (the door row never moves). */
const STREET_Y = SIDEWALK_Y + SURROUNDINGS.sidewalk;
const STREET_CENTRE_Y = STREET_Y + Math.floor(SURROUNDINGS.street / 2);
const STREET_END_Y = STREET_Y + SURROUNDINGS.street - 1;
const FAR_SIDE_Y = STREET_END_Y + 1;

/** What the ground at a tile is, or null when nothing is drawn there (inside the room, or off the map). */
export function groundKind(room: Readonly<Room>, x: number, y: number): GroundKind | null {
  if (isRoomTile(room, x, y)) return null;
  const { x0, x1, y0, y1 } = groundRect(room);
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
  const dx = Math.max(room.x0 - x, x - room.x1, 0);
  const dy = Math.max(room.y0 - y, 0);
  return y < SIDEWALK_Y && Math.max(dx, dy) <= SURROUNDINGS.soilBand ? 'soil' : 'grass';
}

/** Deterministic pseudo-random number in [0, 1) from tile coordinates and a salt. */
function tileHash(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A tile whose hash beats every neighbour within `radius` (so such tiles are never closer than that). */
function isPeak(x: number, y: number, salt: number, radius: number, min: number): boolean {
  const v = tileHash(x, y, salt);
  if (v < min) return false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if ((dx !== 0 || dy !== 0) && tileHash(x + dx, y + dy, salt) >= v) return false;
    }
  }
  return true;
}

/** Tuning of the scattered plants: hash thresholds (higher = rarer) and the keep-out distance of trees. */
const SCATTER = {
  tree: { salt: 1, radius: 2, min: 0.45 },
  bush: { salt: 2, radius: 1, min: 0.6 },
  flower: { salt: 3, chance: 0.045 },
  /** Trees stay at least this many tiles from the walls so crowns only peek over. */
  treeWallGap: 2,
  /** Door side: a lamp post every this many tiles, offset from the door column; benches near it. */
  lampEvery: 7,
  lampOffset: -2,
  benchOffsets: [2, 16],
} as const;

/** Bounding box of the ring around the room in which props may stand. */
function ringTileOk(room: Readonly<Room>, x: number, y: number): boolean {
  const kind = groundKind(room, x, y);
  return kind === 'grass' || kind === 'soil';
}

/**
 * Props around a room: lamps and benches on the sidewalk (the door gap stays clear), and trees,
 * bushes and flowers scattered over the grass and soil by coordinate hash, so growing the room
 * only removes what the new floor covers (or crowds against a wall) and adds props in the newly
 * exposed ring. Pure and deterministic.
 */
export function surroundingProps(room: Readonly<Room>): SurroundingProp[] {
  const out: SurroundingProp[] = [];
  const { x0, x1, y0, y1 } = groundRect(room);
  // Door side: lamp posts and benches on the sidewalk; never in front of the door.
  for (let x = x0; x <= x1; x++) {
    if ((x - DOOR_X - SCATTER.lampOffset) % SCATTER.lampEvery === 0 && x !== DOOR_X) {
      out.push({ kind: 'lamp', x, y: SIDEWALK_Y });
    }
  }
  for (const o of SCATTER.benchOffsets) {
    const x = DOOR_X + o;
    if (x >= x0 && x + 1 <= x1) out.push({ kind: 'bench', x, y: SIDEWALK_Y });
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!ringTileOk(room, x, y)) continue;
      // Distance from the walls (0 right next to them), measured towards the open sides.
      const gap = Math.max(room.x0 - x, x - room.x1, room.y0 - y, 1) - 1;
      const doorSide = y >= SIDEWALK_Y;
      // The tiles right under the walls are their footprint: nothing stands there.
      if (!doorSide && gap < 1) continue;
      if (
        (doorSide || gap >= SCATTER.treeWallGap) &&
        isPeak(x, y, SCATTER.tree.salt, SCATTER.tree.radius, SCATTER.tree.min)
      ) {
        out.push({ kind: tileHash(x, y, 9) < 0.5 ? 'tree_round' : 'tree_tall', x, y });
      } else if (isPeak(x, y, SCATTER.bush.salt, SCATTER.bush.radius, SCATTER.bush.min)) {
        out.push({ kind: tileHash(x, y, 8) < 0.4 ? 'bush_flowers' : 'bush', x, y });
      } else if (tileHash(x, y, SCATTER.flower.salt) < SCATTER.flower.chance) {
        const v = tileHash(x, y, 7);
        out.push({
          kind: v < 0.4 ? 'flower_red' : v < 0.75 ? 'flower_yellow' : 'flower_white',
          x,
          y,
        });
      }
    }
  }
  return out;
}

/** Row on the door side where the far grass strip starts (for tests and the view). */
export const FAR_SIDE_FIRST_Y = FAR_SIDE_Y;
