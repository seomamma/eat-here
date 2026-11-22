/**
 * Floor and wall styles (M12). The player paints floor tiles and back-wall segments; each style
 * has a price per tile / segment, a tiny appeal (see data/happiness.ts for the cap) and an
 * optional rank. Defaults: the start layout's wood floor, checker kitchen floor and cream wall.
 */

export type FloorStyleId = 'wood' | 'checker' | 'terracotta' | 'herringbone';
export type WallStyleId = 'cream' | 'brick' | 'green_stripes' | 'blue_tiles';

export interface SurfaceStyle {
  name: string;
  /** Coins per tile (floor) or per segment (wall). */
  price: number;
  /** Appeal points per tile / segment near a chair (before the cap). */
  appeal: number;
  /** Rank needed (1 = from the start). */
  rank: number;
  /** Colour of the chip in the paint bar (UI only). */
  swatch: string;
}

export const FLOOR_STYLES: Record<FloorStyleId, SurfaceStyle> = {
  wood: { name: 'Oak planks', price: 4, appeal: 0, rank: 1, swatch: '#B9824F' },
  checker: { name: 'Blue checker', price: 4, appeal: 0, rank: 1, swatch: '#8FB3D0' },
  terracotta: { name: 'Terracotta', price: 8, appeal: 1, rank: 2, swatch: '#CF6A46' },
  herringbone: { name: 'Herringbone', price: 14, appeal: 1, rank: 3, swatch: '#E0B07A' },
};

export const WALL_STYLES: Record<WallStyleId, SurfaceStyle> = {
  cream: { name: 'Cream', price: 6, appeal: 0, rank: 1, swatch: '#E3D0AE' },
  brick: { name: 'Red brick', price: 12, appeal: 1, rank: 2, swatch: '#B5473A' },
  green_stripes: { name: 'Green stripes', price: 16, appeal: 1, rank: 3, swatch: '#3E7A3A' },
  blue_tiles: { name: 'Blue tiles', price: 22, appeal: 1, rank: 4, swatch: '#4A6A8F' },
};

export const FLOOR_STYLE_IDS = Object.keys(FLOOR_STYLES) as FloorStyleId[];
export const WALL_STYLE_IDS = Object.keys(WALL_STYLES) as WallStyleId[];

/** Wall segments are named by side and index: `l<y>` on the x = 0 wall, `r<x>` on the y = 0 wall. */
export type WallSegmentId = string;
