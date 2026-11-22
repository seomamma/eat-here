/**
 * Isometric projection helpers (ART_DIRECTION §2). Pure functions, no Phaser.
 *
 * Sim tile (x, y): x runs to the lower-right on screen, y to the lower-left.
 * A tile's origin is the top corner of its 32x16 diamond.
 */

export const ISO_HALF_W = 16;
export const ISO_HALF_H = 8;
/** Diamond size of one floor tile in pixels. */
export const TILE_W = ISO_HALF_W * 2;
export const TILE_H = ISO_HALF_H * 2;

/** Fraction of one depth step used to tie-break equal x + y by x (stays below 1 for x < 128). */
const DEPTH_TIE = 1 / 128;

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Screen position of the top corner of tile (x, y). */
export function tileToScreen(x: number, y: number): Point {
  return { x: (x - y) * ISO_HALF_W, y: (x + y) * ISO_HALF_H };
}

/**
 * Tile under a screen point (diamond hit-test). Uses floor, so a point exactly on a shared
 * edge belongs to the tile on its right/lower side; the top corner belongs to its own tile.
 * Results are not clamped: callers check them against the grid.
 */
export function screenToTile(sx: number, sy: number): Point {
  // Normalised tile coordinates are (sx / 16 + sy / 8) / 2 and (sy / 8 - sx / 16) / 2.
  const x = Math.floor((sx + 2 * sy) / TILE_W);
  const y = Math.floor((2 * sy - sx) / TILE_W);
  return { x: x + 0, y: y + 0 }; // + 0 normalises -0
}

/**
 * Painter's-order key: higher draws in front. Larger x + y is further to the front;
 * equal x + y is tie-broken by x. Fractional positions (walking characters) work too.
 */
export function depthKey(x: number, y: number): number {
  return x + y + x * DEPTH_TIE;
}

/** Screen-space bounding box of the tile rectangle [x0, x1) x [y0, y1). */
export function tileRectBounds(x0: number, y0: number, x1: number, y1: number): Bounds {
  return {
    minX: (x0 - y1) * ISO_HALF_W,
    maxX: (x1 - y0) * ISO_HALF_W,
    minY: (x0 + y0) * ISO_HALF_H,
    maxY: (x1 + y1) * ISO_HALF_H,
  };
}

/** Screen-space bounding box of a whole width x height grid (the floor diamond). */
export function gridBounds(width: number, height: number): Bounds {
  return tileRectBounds(0, 0, width, height);
}
