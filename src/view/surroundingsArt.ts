import type { GroundKind, PropKind } from '../data/surroundings';

/**
 * Texture keys and pivots of the outdoor art (M13b): ground diamonds, trees, bushes, flowers,
 * lamp post and bench, hand-authored in assets/sprites/world/ground.px and props.px (the pivots
 * below match the `pivot` of each sprite there).
 */

export const GROUND_TEX: Record<GroundKind, readonly string[]> = {
  grass: ['ground_grass_0', 'ground_grass_1', 'ground_grass_2'],
  soil: ['ground_soil_0', 'ground_soil_1'],
  sidewalk: ['ground_sidewalk_0', 'ground_sidewalk_1'],
  asphalt: ['ground_asphalt_0', 'ground_asphalt_1'],
  asphalt_line: ['ground_asphalt_line'],
};

/** Colour of the flat canvas behind the world: the grass base, so the ring blends into it. */
export const GROUND_BG_COLOR = 0x6fae4e;

/** Sprite size and the pixel that stands on the tile (organic props: bottom centre of the tile). */
export interface PropTex {
  key: string;
  /** Origin in sprite pixels. Boxes use the footprint's top corner, organic props the feet. */
  originX: number;
  originY: number;
  /** Footprint in tiles (organic props: 1 x 1, placed on the tile centre). */
  w: number;
  h: number;
  /** True: positioned at the tile's top corner like furniture; false: at the tile centre. */
  corner: boolean;
}

export const PROP_TEX: Record<PropKind, PropTex> = {
  tree_round: { key: 'prop_tree_round', originX: 20, originY: 53, w: 1, h: 1, corner: false },
  tree_tall: { key: 'prop_tree_tall', originX: 16, originY: 67, w: 1, h: 1, corner: false },
  bush: { key: 'prop_bush', originX: 12, originY: 13, w: 1, h: 1, corner: false },
  bush_flowers: { key: 'prop_bush_flowers', originX: 12, originY: 13, w: 1, h: 1, corner: false },
  flower_red: { key: 'prop_flower_red', originX: 4, originY: 10, w: 1, h: 1, corner: false },
  flower_yellow: { key: 'prop_flower_yellow', originX: 4, originY: 10, w: 1, h: 1, corner: false },
  flower_white: { key: 'prop_flower_white', originX: 4, originY: 10, w: 1, h: 1, corner: false },
  lamp: { key: 'prop_lamp', originX: 16, originY: 46, w: 1, h: 1, corner: true },
  bench: { key: 'prop_bench', originX: 16, originY: 24, w: 2, h: 1, corner: true },
};
/** Lamp post night glow (drawn above the night veil); pivot at the tile's top corner. */
export const LAMP_GLOW = { key: 'glow_lamp', originX: 28, originY: 52 } as const;
