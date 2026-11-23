import type { FurnitureDefId, Rot } from '../data/furniture';
import { type RecipeId } from '../data/recipes';
import type { FloorStyleId, WallStyleId } from '../data/surfaces';

/**
 * Texture keys of the hand-authored art (D-040) and a few size constants. `installArtAliases`
 * (art.ts) copies atlas frames onto these keys; nothing is drawn in code any more.
 */

/** Back (full height) wall segment: 16 wide, 48 tall including the 8 px diagonal rise. */
export const WALL_BACK_W = 16;
export const WALL_BACK_H = 48;
/** Wall face rows below the top contour; the highest wall pixel sits this far above the floor edge. */
export const WALL_BACK_RISE = 41;
/** Low cut-away wall segment: 16 wide, 12 tall including the 8 px diagonal rise. */
export const WALL_LOW_W = 16;
export const WALL_LOW_H = 12;
/** Door frame sprite size (the door leaf frames have the same size and position). */
export const DOOR_FRAME_W = 16;
export const DOOR_FRAME_H = 40;

export const TEX = {
  floorWood: ['floor_wood_0', 'floor_wood_1'],
  floorTile: 'floor_tile',
  floorTerracotta: 'floor_terracotta',
  floorHerringbone: 'floor_herringbone',
  doorMat: 'door_mat',
  doorFrame: 'door_frame',
  doorClosed: 'door_closed',
  doorOpen: 'door_open',
  wallBackL: 'wall_back_l',
  wallBackLEnd: 'wall_back_l_end',
  wallBackR: 'wall_back_r',
  wallBackREnd: 'wall_back_r_end',
  wallFrontL: 'wall_front_l',
  wallFrontR: 'wall_front_r',
  tileHighlight: 'tile_highlight',
} as const;

export type CharFacing = 'front' | 'back';

/** Emote bubbles (16x16). */
export const EMOTE_TEX = {
  angry: 'emote_angry',
  hand: 'emote_hand',
  tasty: 'emote_tasty',
  love: 'emote_love',
  slow: 'emote_slow',
  heart: 'emote_heart',
  /** A dog walker finds no place for the dog (M12c). */
  brokenHeart: 'emote_heartbroken',
} as const;
/** Bobbing arrow above the selected guest (11x7). */
export const MARKER_TEX = 'select_marker';
/** The 4-frame coin spin: atlas frames `coin_spin_none_<n>`, Phaser animation `coin_spin_none`. */
export const COIN_FRAME = 'coin_spin_none_0';
export const COIN_ANIM = 'coin_spin_none';
/** Sparkle twinkle frames (7x7): texture keys `sparkle_twinkle_<n>`. */
export const SPARKLE_FRAMES = 4;
export const sparkleTex = (n: number): string => `sparkle_twinkle_${n % SPARKLE_FRAMES}`;

/** Dish icons (12x12) and the order bubble that frames them (18x19). */
export const DISH_SIZE = 12;
export const ORDER_BUBBLE_W = 18;
export const ORDER_BUBBLE_H = 19;
export const DISH_TEX: Record<RecipeId, string> = {
  marinara: 'dish_marinara',
  margherita: 'dish_margherita',
  garlic_bread: 'dish_garlic_bread',
  pepperoni: 'dish_pepperoni',
};
export const ORDER_BUBBLE_TEX: Record<RecipeId, string> = {
  marinara: 'order_marinara',
  margherita: 'order_margherita',
  garlic_bread: 'order_garlic_bread',
  pepperoni: 'order_pepperoni',
};

/** Texture key of a back-wall segment in a style (the cream default keeps the original keys). */
export function wallTexKey(side: 'l' | 'r', end: boolean, style: WallStyleId): string {
  const base =
    side === 'l'
      ? end
        ? TEX.wallBackLEnd
        : TEX.wallBackL
      : end
        ? TEX.wallBackREnd
        : TEX.wallBackR;
  return style === 'cream' ? base : `${base}_${style}`;
}

/** Texture key of a floor tile; wood alternates two variants by position. */
export function floorTexKey(style: FloorStyleId, x: number, y: number): string {
  switch (style) {
    case 'checker':
      return TEX.floorTile;
    case 'terracotta':
      return TEX.floorTerracotta;
    case 'herringbone':
      return TEX.floorHerringbone;
    default:
      return TEX.floorWood[(x * 3 + y * 5) % 2] ?? TEX.floorWood[0];
  }
}

/** Furniture textures: the front view is keyed by the piece id, the back view by `<id>_back`. */
export function furnitureTexKey(defId: FurnitureDefId, rot: Rot): string {
  return rot >= 2 ? `${defId}_back` : defId;
}

/** Odd rotations draw the sprite mirrored around the footprint's top corner. */
export function isMirroredRot(rot: Rot): boolean {
  return rot % 2 === 1;
}

/** Overlay textures of the level art: Lv.3+ trim, Lv.5 accent (two blink frames). */
export const trimTexKey = (defId: FurnitureDefId, rot: Rot): string =>
  `trim_${furnitureTexKey(defId, rot)}`;
export const accentTexKey = (defId: FurnitureDefId, rot: Rot, frame: number): string =>
  `accent_${defId}_blink${rot >= 2 ? '_back' : ''}_${frame % ACCENT_FRAMES}`;
/** Pieces whose level art is the oven's own woodpile and copper collar (no trim / accent overlays). */
export const HAS_LEVEL_OVERLAYS = (defId: FurnitureDefId): boolean => defId !== 'oven_pizza';
export const ACCENT_FRAMES = 2;

/** Oven textures: cold mouth, two flicker frames while baking, two flare frames when a pizza goes in or out. */
export const OVEN_TEX = {
  off: 'oven_pizza',
  bake: ['oven_pizza_bake_0', 'oven_pizza_bake_1'],
  flare: ['oven_pizza_flare_0', 'oven_pizza_flare_1'],
} as const;
export const OVEN_EXTRA_TEX = {
  woodpile: 'oven_woodpile',
  copper: 'oven_copper',
} as const;
export const WOODPILE_H = 9;
/** Pieces with a blinking front frame (vending machine lights): keys `<id>_blink_<n>`. */
export const BLINK_FRAMES = 2;
export const blinkTexKey = (defId: FurnitureDefId, frame: number): string =>
  `${defId}_blink_${frame % BLINK_FRAMES}`;
/** Night glow images (drawn above the night veil). */
export const GLOW_TEX = { lamp: 'glow_lamp', floorLamp: 'glow_floor_lamp' } as const;

/** Every texture key the view needs from the atlas (checked once in dev; see art.ts). */
export function requiredTextureKeys(furniture: readonly FurnitureDefId[]): string[] {
  const keys: string[] = [
    ...TEX.floorWood,
    TEX.floorTile,
    TEX.floorTerracotta,
    TEX.floorHerringbone,
    TEX.doorMat,
    TEX.doorFrame,
    TEX.doorClosed,
    TEX.doorOpen,
    TEX.wallBackL,
    TEX.wallBackLEnd,
    TEX.wallBackR,
    TEX.wallBackREnd,
    TEX.wallFrontL,
    TEX.wallFrontR,
    TEX.tileHighlight,
    MARKER_TEX,
    ...Object.values(EMOTE_TEX),
    ...Object.values(DISH_TEX),
    ...Object.values(ORDER_BUBBLE_TEX),
    ...OVEN_TEX.bake,
    ...OVEN_TEX.flare,
    ...Object.values(OVEN_EXTRA_TEX),
    ...Object.values(GLOW_TEX),
    ...Array.from({ length: SPARKLE_FRAMES }, (_, n) => sparkleTex(n)),
  ];
  for (const style of ['brick', 'green_stripes', 'blue_tiles'] as const)
    for (const side of ['l', 'r'] as const)
      for (const end of [false, true]) keys.push(wallTexKey(side, end, style));
  for (const id of furniture) {
    keys.push(id, `${id}_back`);
    if (HAS_LEVEL_OVERLAYS(id)) {
      keys.push(`trim_${id}`, `trim_${id}_back`);
      for (let n = 0; n < ACCENT_FRAMES; n++)
        keys.push(accentTexKey(id, 0, n), accentTexKey(id, 2, n));
    }
  }
  return keys;
}
