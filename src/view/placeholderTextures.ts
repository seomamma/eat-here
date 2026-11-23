import Phaser from 'phaser';
import { FURNITURE, type FurnitureDefId, type Rot } from '../data/furniture';
import { RECIPE_IDS, type RecipeId } from '../data/recipes';
import type { FloorStyleId, WallStyleId } from '../data/surfaces';
import { TILE_H, TILE_W } from './iso';

/**
 * Isometric placeholder art, generated pixel by pixel (no anti-aliasing, strict 2:1 diagonals).
 *
 * Every shape is rasterised by sampling pixel centres against lines of slope 1/2, which gives
 * exact 2-px-across / 1-px-down steps and tiles seamlessly. Sizes follow ART_DIRECTION §3.
 */

/** World palette subset (ART_DIRECTION §4). */
export const C = {
  outline: '#2B1D16',
  wood1: '#5C3A21',
  wood2: '#8A5A34',
  wood3: '#B9824F',
  wood4: '#E0B07A',
  brick1: '#7A2E1F',
  brick2: '#B5473A',
  brick3: '#D9725A',
  cream1: '#F3E6CF',
  cream2: '#E3D0AE',
  cream3: '#C7B08A',
  tomato1: '#9E1F1F',
  tomato2: '#D93A2B',
  tomato3: '#F0664A',
  basil1: '#244D2B',
  basil2: '#3E7A3A',
  basil3: '#6FAE4E',
  basil4: '#A9D46F',
  cheese1: '#C98A2E',
  cheese2: '#EDB94A',
  cheese3: '#FBE29A',
  cool1: '#2F3F5C',
  cool2: '#4A6A8F',
  cool3: '#8FB3D0',
  cool4: '#DCE9F2',
} as const;

/** Back (full height) wall segment: 16 wide, 48 tall including the 8 px diagonal rise. */
export const WALL_BACK_W = 16;
export const WALL_BACK_H = 48;
/** Wall face rows below the top contour; the highest wall pixel sits this far above the floor edge. */
export const WALL_BACK_RISE = 41;
/** Low cut-away wall segment: 16 wide, 12 tall including the 8 px diagonal rise. */
export const WALL_LOW_W = 16;
export const WALL_LOW_H = 12;
/** Door frame sprite size. */
export const DOOR_FRAME_W = 16;
export const DOOR_FRAME_H = 40;

export const TEX = {
  floorWood: ['floor_wood_0', 'floor_wood_1'],
  floorTile: 'floor_tile',
  floorTerracotta: 'floor_terracotta',
  floorHerringbone: 'floor_herringbone',
  doorMat: 'door_mat',
  doorFrame: 'door_frame',
  wallBackL: 'wall_back_l',
  wallBackLEnd: 'wall_back_l_end',
  wallBackR: 'wall_back_r',
  wallBackREnd: 'wall_back_r_end',
  wallFrontL: 'wall_front_l',
  wallFrontR: 'wall_front_r',
  tileHighlight: 'tile_highlight',
} as const;

/** Character frame size (ART_DIRECTION §3): pivot bottom-centre, feet on the last row. */
export const CHAR_W = 16;
export const CHAR_H = 24;
export type CharFacing = 'front' | 'back';

/** Emote bubbles and coin (16x16 / 7x7). */
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
/** Bouncing arrow above the selected guest (11x7). */
export const MARKER_TEX = 'select_marker';
export const COIN_TEX = 'coin';
/** Pixel sparkles for level-up and gifts: a 5x5 plus and a 3x3 plus (M10 juice). */
export const SPARKLE_TEX = { large: 'sparkle_l', small: 'sparkle_s' } as const;
export const EMOTE_SIZE = 16;
export const COIN_SIZE = 7;

export type Pixel = string | null;

/** Pixel buffer with hex colours; null = transparent. */
export class Raster {
  readonly px: Pixel[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array<Pixel>(w * h).fill(null);
  }
  get(x: number, y: number): Pixel {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : (this.px[y * this.w + x] ?? null);
  }
  set(x: number, y: number, c: Pixel): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
}

function hexToRgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Uploads a raster as an exact-size canvas texture (alpha is only ever 0 or 255). */
export function upload(textures: Phaser.Textures.TextureManager, key: string, r: Raster): void {
  if (textures.exists(key)) return;
  const tex = textures.createCanvas(key, r.w, r.h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  const ctx = tex.getContext();
  const img = ctx.createImageData(r.w, r.h);
  r.px.forEach((c, i) => {
    if (!c) return;
    const [R, G, B] = hexToRgb(c);
    img.data.set([R, G, B, 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

export function fromFn(w: number, h: number, fn: (x: number, y: number) => Pixel): Raster {
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r.set(x, y, fn(x, y));
  return r;
}

/** Cheap deterministic hash for speckles (no RNG state; art only). */
export function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
}

// ---------------------------------------------------------------------------------------
// Floors: 32x16 diamonds
// ---------------------------------------------------------------------------------------

/** Tile-local coordinates (i along x, j along y, both 0..1) of a 32x16 diamond pixel, or null outside. */
export function diamondUV(px: number, py: number): { i: number; j: number } | null {
  const X = px + 0.5 - TILE_W / 2;
  const Y = py + 0.5;
  const i = (X / 16 + Y / 8) / 2;
  const j = (Y / 8 - X / 16) / 2;
  return i >= 0 && i < 1 && j >= 0 && j < 1 ? { i, j } : null;
}

function woodFloor(variant: number): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    const plank = Math.floor(jj / 4);
    if (jj % 4 === 0) return C.wood2; // seam between planks (runs along x)
    // Butt joint: staggered per plank, shifted by variant.
    if (ii === (plank * 5 + variant * 7) % 16) return C.wood2;
    const n = hash(px, py, variant);
    if (n < 25) return C.wood4;
    if (n > 960) return C.wood2;
    return C.wood3;
  });
}

/** Terracotta: warm 8x8 tiles with light grout. */
const drawFloorTerracotta = (): Raster =>
  fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    if (ii % 8 === 0 || jj % 8 === 0) return C.cream3; // grout
    const n = hash(px, py, 7);
    if (n < 40) return C.brick3;
    return (Math.floor(ii / 8) + Math.floor(jj / 8)) % 2 === 0 ? '#CF6A46' : '#C25D3C';
  });

/** Herringbone: 4x4 blocks of short planks that turn a quarter every block. */
const drawFloorHerringbone = (): Raster =>
  fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    const flip = (Math.floor(ii / 4) + Math.floor(jj / 4)) % 2 === 0;
    const along = flip ? jj : ii;
    const across = flip ? ii : jj;
    if (along % 2 === 0) return C.wood2; // seam between the short planks
    if (across % 4 === 0 && along % 4 === 1) return C.wood2;
    return hash(px, py, 3) < 80
      ? C.cream1
      : (Math.floor(along / 2) + Math.floor(ii / 4)) % 2 === 0
        ? C.wood4
        : C.cream2;
  });

const drawFloorTile = (): Raster =>
  fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    if (ii % 8 === 0 || jj % 8 === 0) return C.cool3; // grout
    return (Math.floor(ii / 8) + Math.floor(jj / 8)) % 2 === 0 ? C.cool4 : C.cool3;
  });

/** Door mat on the threshold tile: stone border, red mat. */
const drawDoorMat = (): Raster =>
  fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    if (ii < 3 || ii > 12 || jj < 3 || jj > 12) return C.cool3;
    if (ii < 4 || ii > 11 || jj < 4 || jj > 11) return C.cool1;
    return jj % 4 === 0 ? C.brick3 : C.brick2;
  });

/** 1px diamond outline for the debug tap highlight. */
const drawHighlight = (): Raster => {
  const inside = (x: number, y: number) => diamondUV(x, y) !== null;
  return fromFn(TILE_W, TILE_H, (px, py) => {
    if (!inside(px, py)) return null;
    const edge =
      !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
    return edge ? C.tomato3 : null;
  });
};

// ---------------------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------------------

/**
 * Back wall segment. `side` 'r' runs along the y = 0 edge (top contour falls to the right),
 * 'l' along the x = 0 edge (rises to the right). The right wall is the darker one (light from
 * the top-left). `end` draws a vertical outline on the segment's free end.
 */
function backWall(side: 'l' | 'r', end: boolean, style: WallStyleId = 'cream'): Raster {
  const right = side === 'r';
  const cap = right ? C.cream2 : C.cream1;
  const face = right ? C.cream3 : C.cream2;
  const faceShade = right ? '#B09A74' : C.cream3;
  const brick = right ? C.brick1 : C.brick2;
  const brickHi = right ? C.brick2 : C.brick3;
  const mortar = right ? '#5E2217' : C.brick1;
  const bricks = (tx: number, row: number): string => {
    if (row === 0) return brickHi;
    if (row % 4 === 3) return mortar;
    const off = Math.floor(row / 4) % 2 === 0 ? 0 : 4;
    return (tx + off) % 8 === 0 ? mortar : brick;
  };
  return fromFn(WALL_BACK_W, WALL_BACK_H, (tx, ty) => {
    const top = right ? Math.floor(tx / 2) : Math.floor((WALL_BACK_W - 1 - tx) / 2);
    const d = ty - top;
    if (d < 0 || d > WALL_BACK_RISE - 1) return null;
    if (end && tx === (right ? WALL_BACK_W - 1 : 0)) return C.outline;
    if (d === 0 || d === WALL_BACK_RISE - 1) return C.outline;
    if (d <= 2) return cap;
    if (d === 3) return faceShade;
    if (style === 'brick') return bricks(tx, d - 4);
    if (style === 'green_stripes') {
      if (d === 30) return C.wood3; // chair rail
      if (d === 31) return C.wood1;
      if (d > 31) return tx % 4 === 0 ? C.wood1 : tx % 4 === 3 ? C.wood3 : C.wood2; // paneling
      const light = right ? C.basil2 : C.basil3;
      return Math.floor(tx / 2) % 2 === 0 ? light : right ? C.basil1 : C.basil2;
    }
    if (style === 'blue_tiles') {
      if (d === 30) return C.cool4;
      if (d === 31) return C.cool1;
      const grout = right ? C.cool1 : C.cool2;
      const tile = d > 31 ? (right ? C.cool2 : C.cool3) : right ? C.cool3 : C.cool4;
      return tx % 4 === 0 || d % 4 === 0 ? grout : tile;
    }
    if (d === 30) return C.wood2; // chair rail
    if (d === 31) return C.wood1;
    if (d > 31) return bricks(tx, d - 32);
    // Plaster with faint vertical panelling.
    return tx % 8 === 0 ? faceShade : face;
  });
}

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

/** Low cut-away wall segment: 1px cap, 2px face, outline. 'l' = front-left edge, 'r' = front-right. */
function lowWall(side: 'l' | 'r'): Raster {
  const left = side === 'l';
  const face = left ? C.brick2 : C.brick1;
  return fromFn(WALL_LOW_W, WALL_LOW_H, (tx, ty) => {
    const top = left ? Math.floor(tx / 2) : 7 - Math.floor(tx / 2);
    const d = ty - top;
    if (d < 0 || d > 4) return null;
    if (d === 0 || d === 4) return C.outline;
    if (d === 1) return left ? C.cream1 : C.cream2;
    return d === 2 ? (left ? C.brick3 : C.brick2) : face;
  });
}

/** Door frame: two posts and a lintel standing on the front-left wall line (door tile gap). */
function doorFrame(): Raster {
  const r = new Raster(DOOR_FRAME_W, DOOR_FRAME_H);
  const base = (tx: number) => 32 + Math.floor(tx / 2); // lowest pixel row of the wall line
  const height = 27;
  const fill = new Raster(DOOR_FRAME_W, DOOR_FRAME_H);
  for (let tx = 0; tx < DOOR_FRAME_W; tx++) {
    const post = tx < 4 || tx >= DOOR_FRAME_W - 4;
    for (let ty = base(tx) - height; ty <= base(tx); ty++) {
      const lintel = ty <= base(tx) - height + 3;
      if (post || lintel)
        fill.set(tx, ty, lintel ? C.wood3 : tx % 4 === 0 || tx % 4 === 3 ? C.wood1 : C.wood2);
    }
  }
  // Outline silhouette; lintel top highlight.
  for (let ty = 0; ty < DOOR_FRAME_H; ty++) {
    for (let tx = 0; tx < DOOR_FRAME_W; tx++) {
      const c = fill.get(tx, ty);
      if (!c) continue;
      const edge =
        !fill.get(tx - 1, ty) ||
        !fill.get(tx + 1, ty) ||
        !fill.get(tx, ty - 1) ||
        !fill.get(tx, ty + 1);
      r.set(tx, ty, edge ? C.outline : c);
    }
  }
  return r;
}

// ---------------------------------------------------------------------------------------
// Characters now come from the sprite atlas (assets/sprites/characters, D-040)
// ---------------------------------------------------------------------------------------

/** 16x16 speech bubble with a tail, pixel face inside. */
type EmoteKind = keyof typeof EMOTE_TEX;
const EMOTE_COLORS: Record<EmoteKind, { bg: string; fg: string }> = {
  angry: { bg: C.tomato2, fg: C.cream1 },
  hand: { bg: C.cheese3, fg: C.outline },
  tasty: { bg: C.cheese3, fg: C.outline },
  love: { bg: C.cream1, fg: C.tomato2 },
  heart: { bg: C.tomato2, fg: C.cream1 },
  brokenHeart: { bg: C.cream1, fg: C.tomato2 },
  slow: { bg: C.cool3, fg: C.cool1 },
};

function emoteBubble(kind: EmoteKind): Raster {
  const { bg, fg } = EMOTE_COLORS[kind];
  const r = new Raster(EMOTE_SIZE, EMOTE_SIZE);
  // Rounded body 14x11 at (1,1), tail below.
  for (let y = 1; y <= 11; y++) {
    for (let x = 1; x <= 14; x++) {
      const corner = (x === 1 || x === 14) && (y === 1 || y === 11);
      if (corner) continue;
      const edge = x === 1 || x === 14 || y === 1 || y === 11;
      r.set(x, y, edge ? C.outline : bg);
    }
  }
  for (const [x, y] of [
    [7, 12],
    [8, 12],
    [7, 13],
  ] as const)
    r.set(x, y, C.outline);
  r.set(8, 11, bg);
  r.set(7, 11, bg);
  if (kind === 'hand') {
    // Raised hand: four fingers, palm and thumb (silhouette).
    for (const [x, y] of [
      [5, 4],
      [5, 5],
      [7, 3],
      [7, 4],
      [7, 5],
      [9, 3],
      [9, 4],
      [9, 5],
      [11, 4],
      [11, 5],
      [4, 8],
      [3, 7],
      [3, 6],
    ] as const)
      r.set(x, y, fg);
    for (let y = 6; y <= 9; y++) for (let x = 5; x <= 11; x++) r.set(x, y, fg);
    r.set(4, 7, fg);
    r.set(6, 5, fg);
    r.set(8, 5, fg);
    r.set(10, 5, fg);
  } else if (kind === 'angry') {
    // Slanted brows and a grim mouth.
    for (const [x, y] of [
      [4, 4],
      [5, 5],
      [6, 5],
      [11, 4],
      [10, 5],
      [9, 5],
      [5, 7],
      [10, 7],
    ] as const)
      r.set(x, y, fg);
    for (const x of [5, 6, 7, 8, 9, 10]) r.set(x, 9, fg);
    r.set(4, 10, bg);
  } else if (kind === 'love' || kind === 'heart' || kind === 'brokenHeart') {
    // Heart (a crack down the middle for the broken one).
    for (const [y, x0, x1] of [
      [3, 5, 6],
      [3, 9, 10],
      [4, 4, 11],
      [5, 4, 11],
      [6, 5, 10],
      [7, 6, 9],
      [8, 7, 8],
    ] as const)
      for (let x = x0; x <= x1; x++) r.set(x, y, fg);
    if (kind === 'brokenHeart') {
      for (const [x, y] of [
        [7, 3],
        [8, 4],
        [7, 5],
        [8, 6],
        [7, 7],
      ] as const)
        r.set(x, y, bg);
    }
  } else if (kind === 'slow') {
    // "zz": a big and a small z.
    for (const [y, x0, x1] of [
      [3, 4, 8],
      [4, 7, 7],
      [5, 6, 6],
      [6, 5, 5],
      [7, 4, 8],
      [6, 9, 12],
      [7, 11, 11],
      [8, 10, 10],
      [9, 9, 12],
    ] as const)
      for (let x = x0; x <= x1; x++) r.set(x, y, fg);
  } else {
    // Tasty: happy closed eyes and a smile.
    for (const [x, y] of [
      [4, 5],
      [5, 4],
      [6, 5],
      [9, 5],
      [10, 4],
      [11, 5],
    ] as const)
      r.set(x, y, fg);
    for (const [x, y] of [
      [4, 8],
      [5, 9],
      [6, 9],
      [7, 9],
      [8, 9],
      [9, 9],
      [10, 9],
      [11, 8],
    ] as const)
      r.set(x, y, fg);
  }
  return r;
}

/** Downward arrow with outline, 11x7. */
function selectMarker(): Raster {
  const fill = new Raster(11, 7);
  for (let row = 0; row < 5; row++)
    for (let x = 1 + row; x <= 9 - row; x++) fill.set(x, row + 1, C.cheese2);
  const r = new Raster(11, 7);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 11; x++) {
      const c = fill.get(x, y);
      if (c) r.set(x, y, c);
      else if (fill.get(x - 1, y) || fill.get(x + 1, y) || fill.get(x, y - 1) || fill.get(x, y + 1))
        r.set(x, y, C.outline);
    }
  }
  return r;
}

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

function dishIcon(id: RecipeId): Raster {
  const fill = new Raster(DISH_SIZE, DISH_SIZE);
  if (id === 'garlic_bread') {
    for (const y0 of [2, 6]) {
      for (let y = y0; y < y0 + 3; y++) for (let x = 1; x <= 10; x++) fill.set(x, y, C.wood4);
      for (const x of [3, 6, 9]) for (let y = y0; y < y0 + 3; y++) fill.set(x, y, C.cheese2);
      fill.set(4, y0 + 1, C.basil3);
      fill.set(8, y0 + 1, C.basil3);
    }
  } else {
    // Round pizza: crust ring, sauce/cheese and toppings.
    const base = id === 'marinara' ? C.tomato2 : C.cheese2;
    for (let y = 0; y < DISH_SIZE; y++) {
      for (let x = 0; x < DISH_SIZE; x++) {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d <= 5.6) fill.set(x, y, d > 4.4 ? C.wood3 : base);
      }
    }
    const spots: Record<string, [string, [number, number][]]> = {
      marinara: [
        C.basil3,
        [
          [4, 4],
          [7, 6],
          [5, 7],
        ],
      ],
      margherita: [
        C.tomato2,
        [
          [4, 3],
          [7, 4],
          [4, 7],
          [7, 7],
        ],
      ],
      pepperoni: [
        C.brick2,
        [
          [4, 3],
          [7, 4],
          [4, 7],
          [7, 7],
          [6, 5],
        ],
      ],
    };
    const [c, pts] = spots[id] ?? [C.basil3, []];
    for (const [x, y] of pts) {
      fill.set(x, y, c);
      if (id === 'pepperoni') fill.set(x + 1, y, c);
    }
    if (id === 'margherita') {
      fill.set(5, 5, C.basil3);
      fill.set(6, 6, C.basil3);
    }
  }
  const r = new Raster(DISH_SIZE, DISH_SIZE);
  for (let y = 0; y < DISH_SIZE; y++) {
    for (let x = 0; x < DISH_SIZE; x++) {
      const c = fill.get(x, y);
      if (!c) continue;
      const edge =
        !fill.get(x - 1, y) || !fill.get(x + 1, y) || !fill.get(x, y - 1) || !fill.get(x, y + 1);
      r.set(x, y, edge ? C.outline : c);
    }
  }
  return r;
}

/** Speech bubble (cream) with the dish inside and a tail pointing at the guest. */
function orderBubble(id: RecipeId): Raster {
  const r = new Raster(ORDER_BUBBLE_W, ORDER_BUBBLE_H);
  for (let y = 0; y <= 15; y++) {
    for (let x = 0; x <= 17; x++) {
      if ((x === 0 || x === 17) && (y === 0 || y === 15)) continue;
      const edge = x === 0 || x === 17 || y === 0 || y === 15;
      r.set(x, y, edge ? C.outline : C.cream1);
    }
  }
  for (const [x, y] of [
    [8, 16],
    [9, 16],
    [8, 17],
  ] as const)
    r.set(x, y, C.outline);
  r.set(8, 15, C.cream1);
  r.set(9, 15, C.cream1);
  const icon = dishIcon(id);
  for (let y = 0; y < DISH_SIZE; y++)
    for (let x = 0; x < DISH_SIZE; x++) {
      const c = icon.get(x, y);
      if (c) r.set(x + 3, y + 2, c);
    }
  return r;
}

function coin(): Raster {
  const r = new Raster(COIN_SIZE, COIN_SIZE);
  for (let y = 0; y < COIN_SIZE; y++) {
    for (let x = 0; x < COIN_SIZE; x++) {
      const dx = x - 3;
      const dy = y - 3;
      const d = dx * dx + dy * dy;
      if (d > 11) continue;
      r.set(x, y, d > 7 ? C.outline : C.cheese2);
    }
  }
  r.set(2, 2, C.cheese3);
  r.set(3, 2, C.cheese3);
  r.set(3, 3, C.cheese1);
  r.set(3, 4, C.cheese1);
  return r;
}

/** A tiny plus-shaped sparkle: bright core, warm arms. */
function sparkle(size: 3 | 5): Raster {
  const r = new Raster(size, size);
  const mid = (size - 1) / 2;
  for (let i = 0; i < size; i++) {
    const d = Math.abs(i - mid);
    const c = d === 0 ? C.cream1 : d === 1 ? C.cheese3 : C.cheese2;
    r.set(i, mid, c);
    r.set(mid, i, c);
  }
  return r;
}

// ---------------------------------------------------------------------------------------
// Furniture: isometric boxes
// ---------------------------------------------------------------------------------------

type Face = 'top' | 'left' | 'right';

export interface Part {
  /** Footprint sub-rectangle in tile units (i along x, j along y). */
  i0: number;
  j0: number;
  i1: number;
  j1: number;
  /** Bottom and top elevation in px. */
  z0: number;
  z1: number;
  top: string;
  left: string;
  right: string;
  /**
   * Optional decal for side faces: `a` is the pixel distance along the face from its back end
   * (0..), `e` the elevation above the part's bottom in px. Return a colour or undefined.
   */
  decal?: (face: Face, a: number, e: number) => string | undefined;
}

/** Shorthand for a wood-ish box. */
export function part(p: Omit<Part, 'decal'> & { decal?: Part['decal'] }): Part {
  return p;
}

/** Rasterises painter-ordered boxes with a per-part 1px outline. `o` = top corner pixel. */
export function boxes(w: number, h: number, ox: number, oy: number, parts: Part[]): Raster {
  const r = new Raster((w + h) * 16, oy + (w + h) * 8);
  const sorted = [...parts].sort((a, b) => a.i0 + a.j0 + a.z0 / 64 - (b.i0 + b.j0 + b.z0 / 64));
  for (const p of sorted) {
    const mask = new Raster(r.w, r.h);
    const col = new Raster(r.w, r.h);
    for (let py = 0; py < r.h; py++) {
      for (let px = 0; px < r.w; px++) {
        const X = px + 0.5 - ox;
        const Y = py + 0.5 - oy;
        // Top face at elevation z1.
        const Yt = Y + p.z1;
        const it = (X / 16 + Yt / 8) / 2;
        const jt = (Yt / 8 - X / 16) / 2;
        let c: string | undefined;
        if (it >= p.i0 && it < p.i1 && jt >= p.j0 && jt < p.j1) {
          c = p.decal?.('top', it, jt) ?? p.top;
        } else {
          // Left face: plane j = j1 (faces the lower-left).
          const il = X / 16 + p.j1;
          const el = (il + p.j1) * 8 - Y;
          if (il >= p.i0 && il < p.i1 && el >= p.z0 && el < p.z1) {
            c = p.decal?.('left', (il - p.i0) * 16, el - p.z0) ?? p.left;
          } else {
            // Right face: plane i = i1 (faces the lower-right).
            const jr = p.i1 - X / 16;
            const er = (p.i1 + jr) * 8 - Y;
            if (jr >= p.j0 && jr < p.j1 && er >= p.z0 && er < p.z1) {
              c = p.decal?.('right', (jr - p.j0) * 16, er - p.z0) ?? p.right;
            }
          }
        }
        if (c) {
          mask.set(px, py, c);
          col.set(px, py, c);
        }
      }
    }
    for (let py = 0; py < r.h; py++) {
      for (let px = 0; px < r.w; px++) {
        const c = mask.get(px, py);
        if (!c) continue;
        const edge =
          !mask.get(px - 1, py) ||
          !mask.get(px + 1, py) ||
          !mask.get(px, py - 1) ||
          !mask.get(px, py + 1);
        r.set(px, py, edge ? C.outline : c);
      }
    }
  }
  return r;
}

/** Wood legs at the four corners of a [i0,i1] x [j0,j1] area. */
function legs(i0: number, j0: number, i1: number, j1: number, z1: number, t = 0.14): Part[] {
  const mk = (i: number, j: number): Part =>
    part({
      i0: i,
      j0: j,
      i1: i + t,
      j1: j + t,
      z0: 0,
      z1,
      top: C.wood3,
      left: C.wood2,
      right: C.wood1,
    });
  return [mk(i0, j0), mk(i1 - t, j0), mk(i0, j1 - t), mk(i1 - t, j1 - t)];
}

/**
 * Texture of a furniture piece for a rotation (D-030): rot 0/1 use the front view, rot 2/3 the
 * back view; odd rotations are the same sprite mirrored (see `isMirroredRot`).
 */
export function furnitureTexKey(defId: FurnitureDefId, rot: Rot): string {
  return rot >= 2 ? `${defId}_back` : defId;
}

/** Odd rotations draw the sprite mirrored around the footprint's top corner. */
export function isMirroredRot(rot: Rot): boolean {
  return rot % 2 === 1;
}

export type OvenGlow = 'off' | 0 | 1;
/** Baking frames alternate (flicker); 'off' is a cold, dim mouth. */
export const OVEN_TEX = {
  off: 'oven_pizza',
  bake: ['oven_pizza_bake_0', 'oven_pizza_bake_1'],
} as const;

/** Back view of the oven (rot 2/3): the mouth is on the hidden side, so no glow either. */
function ovenArt(ox: number, oy: number, glow: OvenGlow, back = false): Raster {
  return boxes(2, 1, ox, oy, [
    part({
      i0: 0,
      j0: 0,
      i1: 2,
      j1: 1,
      z0: 0,
      z1: 14,
      top: C.brick3,
      left: C.brick2,
      right: C.brick1,
      decal: (face, a, e) => {
        if (face === 'top') return undefined;
        if (face === 'left' && !back) {
          // Mouth on the +y face the chef stands in front of.
          const dx = Math.abs(a - 16);
          if (dx < 7 && e < 9 && e >= 1) {
            if (dx < 4 && e < 6) {
              if (glow === 'off') return e < 2 ? C.tomato1 : C.outline;
              const flick = glow === 1 ? 1 : 0;
              if (e < 3 + flick) return C.cheese3;
              return e < 4.5 + flick ? C.cheese2 : glow === 1 ? C.tomato3 : C.tomato2;
            }
            return C.outline;
          }
        }
        return Math.floor(e) % 4 === 3 ? C.brick1 : undefined;
      },
    }),
    // Chimney block.
    part({
      i0: 0.75,
      j0: 0.3,
      i1: 1.25,
      j1: 0.7,
      z0: 14,
      z1: 22,
      top: C.cream2,
      left: C.brick2,
      right: C.brick1,
    }),
  ]);
}

/** Oven level visuals (M12 addendum): Lv.3+ a woodpile next to it, Lv.5 a copper collar. */
export const OVEN_EXTRA_TEX = {
  woodpile: 'oven_woodpile',
  copper: 'oven_copper',
} as const;
export const WOODPILE_W = 10;
export const WOODPILE_H = 9;

/** Three stacked logs with pale ends, outlined. */
function woodpile(): Raster {
  const fill = new Raster(WOODPILE_W, WOODPILE_H);
  const log = (x0: number, y0: number) => {
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = x0; x < x0 + 5; x++)
        fill.set(x, y, x < x0 + 2 ? C.wood4 : y === y0 ? C.wood3 : C.wood2);
    }
    fill.set(x0, y0 + 1, C.wood3); // growth ring
    fill.set(x0 + 1, y0 + 2, C.wood3);
  };
  log(0, 5);
  log(5, 5);
  log(2, 1);
  const r = new Raster(WOODPILE_W, WOODPILE_H);
  for (let y = 0; y < WOODPILE_H; y++) {
    for (let x = 0; x < WOODPILE_W; x++) {
      const c = fill.get(x, y);
      if (!c) continue;
      const edge =
        !fill.get(x - 1, y) || !fill.get(x + 1, y) || !fill.get(x, y - 1) || !fill.get(x, y + 1);
      r.set(x, y, edge ? C.outline : c);
    }
  }
  return r;
}

/** Copper collar around the chimney: same sprite size as the oven, only the accent is drawn. */
function ovenCopper(ox: number, oy: number): Raster {
  return boxes(2, 1, ox, oy, [
    part({
      i0: 0.68,
      j0: 0.23,
      i1: 1.32,
      j1: 0.77,
      z0: 16,
      z1: 19,
      top: C.cheese3,
      left: '#C77B3C',
      right: '#9A5A2B',
    }),
    part({
      i0: 0.7,
      j0: 0.25,
      i1: 1.3,
      j1: 0.75,
      z0: 22,
      z1: 23,
      top: C.cheese3,
      left: '#C77B3C',
      right: '#9A5A2B',
    }),
  ]);
}

/** `back` draws the back view (rot 2/3); pieces that look the same from behind ignore it. */
type FurnitureArt = (ox: number, oy: number, back: boolean) => Raster;

const FURNITURE_ART: Record<FurnitureDefId, FurnitureArt> = {
  table_small: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      ...legs(0.12, 0.12, 0.88, 0.88, 9),
      part({
        i0: 0.06,
        j0: 0.06,
        i1: 0.94,
        j1: 0.94,
        z0: 9,
        z1: 12,
        top: C.tomato3,
        left: C.tomato2,
        right: C.tomato1,
      }),
      // Little plate on the cloth.
      part({
        i0: 0.38,
        j0: 0.38,
        i1: 0.62,
        j1: 0.62,
        z0: 12,
        z1: 13,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
    ]),
  chair_wood: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      ...legs(0.2, 0.2, 0.8, 0.8, 5, 0.12),
      part({
        i0: 0.16,
        j0: 0.16,
        i1: 0.84,
        j1: 0.84,
        z0: 5,
        z1: 8,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
      // Front view (faces +y): backrest on the -y side, behind the seat. Back view (faces -y):
      // the backrest is on the +y side, towards the viewer.
      part({
        i0: 0.16,
        j0: back ? 0.7 : 0.16,
        i1: 0.84,
        j1: back ? 0.84 : 0.3,
        z0: 8,
        z1: 18,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
    ]),
  oven_pizza: (ox, oy, back) => ovenArt(ox, oy, 'off', back),
  counter_pass: (ox, oy, back) =>
    boxes(2, 1, ox, oy, [
      part({
        i0: 0,
        j0: 0.1,
        i1: 2,
        j1: 0.9,
        z0: 0,
        z1: 11,
        top: C.cream1,
        left: C.wood3,
        right: C.wood2,
        decal: (face, a, e) => {
          // Front: panelled cupboard doors. Back: a plain shelf edge.
          if (!back && face === 'left' && e > 2 && e < 9 && a % 16 > 2 && a % 16 < 14) {
            return C.wood2;
          }
          if (back && face === 'left' && e > 6 && e < 8) return C.wood2;
          return undefined;
        },
      }),
      // Warming plates on top (swapped ends in the back view).
      part({
        i0: back ? 1.35 : 0.25,
        j0: 0.3,
        i1: back ? 1.75 : 0.65,
        j1: 0.7,
        z0: 11,
        z1: 13,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
      part({
        i0: back ? 0.3 : 1.2,
        j0: 0.3,
        i1: back ? 0.8 : 1.7,
        j1: 0.7,
        z0: 11,
        z1: 12,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
    ]),
  plant_potted: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.25,
        j0: 0.25,
        i1: 0.75,
        j1: 0.75,
        z0: 0,
        z1: 8,
        top: C.brick3,
        left: C.brick2,
        right: C.brick1,
      }),
      part({
        i0: 0.12,
        j0: 0.12,
        i1: 0.88,
        j1: 0.88,
        z0: 8,
        z1: 18,
        top: C.basil4,
        left: C.basil3,
        right: C.basil2,
      }),
      part({
        i0: 0.3,
        j0: 0.3,
        i1: 0.7,
        j1: 0.7,
        z0: 18,
        z1: 22,
        top: C.basil4,
        left: C.basil3,
        right: C.basil2,
      }),
    ]),
  chair_cushion: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      ...legs(0.2, 0.2, 0.8, 0.8, 5, 0.12),
      part({
        i0: 0.14,
        j0: 0.14,
        i1: 0.86,
        j1: 0.86,
        z0: 5,
        z1: 9,
        top: C.tomato3,
        left: C.tomato2,
        right: C.tomato1,
      }),
      part({
        i0: 0.16,
        j0: back ? 0.7 : 0.14,
        i1: 0.84,
        j1: back ? 0.86 : 0.3,
        z0: 9,
        z1: 19,
        top: C.tomato3,
        left: C.tomato2,
        right: C.tomato1,
      }),
    ]),
  // High chair (kids): tall legs, small seat, a tray bar in front and a tall backrest.
  chair_high: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      ...legs(0.22, 0.22, 0.78, 0.78, 8, 0.12),
      part({
        i0: 0.2,
        j0: 0.2,
        i1: 0.8,
        j1: 0.8,
        z0: 8,
        z1: 11,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
      part({
        i0: 0.2,
        j0: back ? 0.68 : 0.2,
        i1: 0.8,
        j1: back ? 0.8 : 0.32,
        z0: 11,
        z1: 22,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
    ]),
  table_long: (ox, oy) =>
    boxes(2, 1, ox, oy, [
      ...legs(0.12, 0.12, 1.88, 0.88, 9),
      part({
        i0: 0.06,
        j0: 0.06,
        i1: 1.94,
        j1: 0.94,
        z0: 9,
        z1: 12,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
      // Red runner with two plates.
      part({
        i0: 0.15,
        j0: 0.36,
        i1: 1.85,
        j1: 0.64,
        z0: 12,
        z1: 13,
        top: C.tomato3,
        left: C.tomato2,
        right: C.tomato1,
      }),
      part({
        i0: 0.32,
        j0: 0.4,
        i1: 0.55,
        j1: 0.6,
        z0: 13,
        z1: 14,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
      part({
        i0: 1.45,
        j0: 0.4,
        i1: 1.68,
        j1: 0.6,
        z0: 13,
        z1: 14,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
    ]),
  vending_machine: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.1,
        j0: 0.1,
        i1: 0.9,
        j1: 0.9,
        z0: 0,
        z1: 26,
        top: C.tomato3,
        left: C.tomato2,
        right: C.tomato1,
        decal: (face, a, e) => {
          if (back || face !== 'left') return undefined;
          // Glass window with three shelves of snacks, buttons and a dispenser slot.
          if (a > 1.5 && a < 9.5 && e > 9 && e < 23) {
            if (e > 13 && e < 14.5) return C.cool2;
            if (e > 18 && e < 19.5) return C.cool2;
            const row = e < 14 ? 0 : e < 19 ? 1 : 2;
            if (e % 5 > 1 && e % 5 < 4 && Math.floor(a / 2) % 2 === 0) {
              return [C.cheese2, C.basil3, C.cream1][(row + Math.floor(a / 2)) % 3];
            }
            return C.cool4;
          }
          if (a > 10 && a < 12 && e > 12 && e < 19) return e % 3 < 1.5 ? C.cheese2 : C.cheese3;
          if (a > 1.5 && a < 9.5 && e > 3 && e < 6.5) return C.outline;
          return undefined;
        },
      }),
      part({
        i0: 0.18,
        j0: 0.18,
        i1: 0.82,
        j1: 0.82,
        z0: 26,
        z1: 28,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
    ]),
  piano: (ox, oy, back) =>
    boxes(2, 1, ox, oy, [
      // Cabinet: tall at the back, with the keyboard shelf in front (front view faces +y).
      part({
        i0: 0.05,
        j0: back ? 0.5 : 0.15,
        i1: 1.95,
        j1: back ? 0.85 : 0.5,
        z0: 0,
        z1: 22,
        top: C.cool2,
        left: C.cool1,
        right: '#1D2638',
        decal: (face, a, e) => {
          if (face === 'left' && !back && e > 14 && e < 18 && a % 8 > 1) return C.cool3;
          return undefined;
        },
      }),
      part({
        i0: 0.05,
        j0: back ? 0.15 : 0.5,
        i1: 1.95,
        j1: back ? 0.5 : 0.85,
        z0: 0,
        z1: 12,
        top: C.cool1,
        left: C.cool1,
        right: '#1D2638',
        decal: (face, a, e) => {
          if (face === 'top' && !back) {
            // White keys with black keys on top (a = tile units along x).
            const k = Math.floor(a * 14);
            if (e > 0.3) return k % 2 === 0 || k % 7 === 2 || k % 7 === 6 ? C.cream1 : C.outline;
            return C.cream1;
          }
          return undefined;
        },
      }),
      // Two brass candlesticks on the lid.
      part({
        i0: 0.2,
        j0: back ? 0.55 : 0.25,
        i1: 0.32,
        j1: back ? 0.65 : 0.35,
        z0: 22,
        z1: 26,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
    ]),
  toilet: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.1,
        j0: 0.1,
        i1: 0.9,
        j1: 0.9,
        z0: 0,
        z1: 24,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
        decal: (face, a, e) => {
          if (back || face !== 'left') return undefined;
          // Blue door with a handle and a small sign.
          if (a > 2.5 && a < 10 && e > 1 && e < 17) {
            if (a > 8.2 && a < 9.2 && e > 8 && e < 10) return C.cheese2;
            return a < 3.7 || a > 8.8 || e > 15.8 ? C.cool1 : C.cool3;
          }
          if (a > 4.5 && a < 8 && e > 18.5 && e < 22) return e % 2.2 < 1.1 ? C.cool2 : C.cool4;
          return undefined;
        },
      }),
      part({
        i0: 0.04,
        j0: 0.04,
        i1: 0.96,
        j1: 0.96,
        z0: 24,
        z1: 26,
        top: C.cool3,
        left: C.cool2,
        right: C.cool1,
      }),
    ]),
  flower_box: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.08,
        j0: 0.2,
        i1: 0.92,
        j1: 0.8,
        z0: 0,
        z1: 6,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
        decal: (face, _a, e) => (face === 'left' && e > 2 && e < 3.2 ? C.wood2 : undefined),
      }),
      part({
        i0: 0.14,
        j0: 0.26,
        i1: 0.86,
        j1: 0.74,
        z0: 6,
        z1: 8,
        top: C.basil3,
        left: C.basil2,
        right: C.basil1,
      }),
      ...(
        [
          [0.2, 0.35, C.tomato3, 11],
          [0.45, 0.5, C.cheese3, 12],
          [0.62, 0.32, C.cream1, 11],
          [0.74, 0.5, C.tomato3, 10],
          [0.33, 0.55, C.cheese3, 10],
        ] as const
      ).map(([i, j, c, z]) =>
        part({ i0: i, j0: j, i1: i + 0.12, j1: j + 0.12, z0: 8, z1: z, top: c, left: c, right: c }),
      ),
    ]),
  divider: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0,
        j0: 0.42,
        i1: 1,
        j1: 0.58,
        z0: 0,
        z1: 13,
        top: C.wood4,
        left: C.cream2,
        right: C.cream3,
        decal: (face, a, e) => {
          if (face !== 'left') return undefined;
          // Wooden frame around a cream panel.
          if (a < 1.8 || a > 14.2 || e < 1.8 || e > 10.5) return C.wood3;
          return (Math.floor(a / 4) + Math.floor(e / 4)) % 2 === 0 ? undefined : C.cream1;
        },
      }),
      part({
        i0: 0,
        j0: 0.36,
        i1: 0.14,
        j1: 0.64,
        z0: 0,
        z1: 15,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
      part({
        i0: 0.86,
        j0: 0.36,
        i1: 1,
        j1: 0.64,
        z0: 0,
        z1: 15,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
    ]),
  floor_lamp: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.32,
        j0: 0.32,
        i1: 0.68,
        j1: 0.68,
        z0: 0,
        z1: 2,
        top: C.wood3,
        left: C.wood2,
        right: C.wood1,
      }),
      part({
        i0: 0.45,
        j0: 0.45,
        i1: 0.55,
        j1: 0.55,
        z0: 2,
        z1: 20,
        top: C.wood3,
        left: C.wood2,
        right: C.wood1,
      }),
      part({
        i0: 0.24,
        j0: 0.24,
        i1: 0.76,
        j1: 0.76,
        z0: 18,
        z1: 26,
        top: C.cream1,
        left: C.cheese3,
        right: C.cheese2,
      }),
    ]),
  painting_easel: (ox, oy, back) =>
    boxes(1, 1, ox, oy, [
      ...legs(0.14, 0.38, 0.86, 0.62, 9, 0.1),
      part({
        i0: 0.1,
        j0: 0.4,
        i1: 0.9,
        j1: 0.6,
        z0: 6,
        z1: 9,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
      part({
        i0: 0.1,
        j0: 0.45,
        i1: 0.9,
        j1: 0.55,
        z0: 9,
        z1: 25,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
        decal: (face, a, e) => {
          if (back || face !== 'left') return undefined;
          if (a < 1.6 || a > 11.2 || e < 1.6 || e > 14.4) return C.wood2; // frame
          // Landscape: sky, sun, hills.
          if (e > 9) return Math.hypot(a - 9, e - 12.5) < 1.7 ? C.cheese2 : C.cool3;
          return e > 5.5 ? C.basil3 : C.basil2;
        },
      }),
    ]),
  pillar: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.12,
        j0: 0.12,
        i1: 0.88,
        j1: 0.88,
        z0: 0,
        z1: 4,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
      part({
        i0: 0.24,
        j0: 0.24,
        i1: 0.76,
        j1: 0.76,
        z0: 4,
        z1: 33,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
        decal: (face, a) => (face !== 'top' && a % 5 < 1 ? C.cream3 : undefined),
      }),
      part({
        i0: 0.12,
        j0: 0.12,
        i1: 0.88,
        j1: 0.88,
        z0: 33,
        z1: 37,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
    ]),
  statue: (ox, oy) =>
    boxes(1, 1, ox, oy, [
      part({
        i0: 0.12,
        j0: 0.12,
        i1: 0.88,
        j1: 0.88,
        z0: 0,
        z1: 4,
        top: C.cream2,
        left: C.cream3,
        right: '#B09A74',
      }),
      part({
        i0: 0.2,
        j0: 0.2,
        i1: 0.8,
        j1: 0.8,
        z0: 4,
        z1: 11,
        top: C.cream1,
        left: C.cream2,
        right: C.cream3,
      }),
      // Robed figure with raised head.
      part({
        i0: 0.32,
        j0: 0.32,
        i1: 0.68,
        j1: 0.68,
        z0: 11,
        z1: 26,
        top: C.cool4,
        left: C.cool4,
        right: C.cool3,
      }),
      part({
        i0: 0.38,
        j0: 0.38,
        i1: 0.62,
        j1: 0.62,
        z0: 26,
        z1: 32,
        top: C.cool4,
        left: C.cool4,
        right: C.cool3,
      }),
    ]),
};

/** Raster of a furniture piece's front (or back) view; also used for the shop icons. */
export function furnitureRaster(defId: FurnitureDefId, back = false): Raster {
  const [ox, oy] = FURNITURE[defId].spriteOrigin;
  return FURNITURE_ART[defId](ox, oy, back);
}

/** Generates every placeholder texture at real pixel sizes. Idempotent. */
export function generatePlaceholderTextures(textures: Phaser.Textures.TextureManager): void {
  upload(textures, TEX.floorWood[0], woodFloor(0));
  upload(textures, TEX.floorWood[1], woodFloor(1));
  upload(textures, TEX.floorTile, drawFloorTile());
  upload(textures, TEX.floorTerracotta, drawFloorTerracotta());
  upload(textures, TEX.floorHerringbone, drawFloorHerringbone());
  upload(textures, TEX.doorMat, drawDoorMat());
  upload(textures, TEX.doorFrame, doorFrame());
  upload(textures, TEX.wallBackL, backWall('l', false));
  upload(textures, TEX.wallBackLEnd, backWall('l', true));
  upload(textures, TEX.wallBackR, backWall('r', false));
  upload(textures, TEX.wallBackREnd, backWall('r', true));
  for (const style of ['brick', 'green_stripes', 'blue_tiles'] as const) {
    for (const side of ['l', 'r'] as const) {
      for (const end of [false, true]) {
        upload(textures, wallTexKey(side, end, style), backWall(side, end, style));
      }
    }
  }
  upload(textures, TEX.wallFrontL, lowWall('l'));
  upload(textures, TEX.wallFrontR, lowWall('r'));
  upload(textures, TEX.tileHighlight, drawHighlight());
  upload(textures, EMOTE_TEX.angry, emoteBubble('angry'));
  upload(textures, EMOTE_TEX.hand, emoteBubble('hand'));
  upload(textures, EMOTE_TEX.tasty, emoteBubble('tasty'));
  upload(textures, EMOTE_TEX.love, emoteBubble('love'));
  upload(textures, EMOTE_TEX.slow, emoteBubble('slow'));
  upload(textures, EMOTE_TEX.heart, emoteBubble('heart'));
  upload(textures, EMOTE_TEX.brokenHeart, emoteBubble('brokenHeart'));
  upload(textures, MARKER_TEX, selectMarker());
  upload(textures, COIN_TEX, coin());
  upload(textures, SPARKLE_TEX.large, sparkle(5));
  upload(textures, SPARKLE_TEX.small, sparkle(3));
  for (const id of RECIPE_IDS) {
    upload(textures, DISH_TEX[id], dishIcon(id));
    upload(textures, ORDER_BUBBLE_TEX[id], orderBubble(id));
  }
  const [ovx, ovy] = FURNITURE.oven_pizza.spriteOrigin;
  upload(textures, OVEN_EXTRA_TEX.woodpile, woodpile());
  upload(textures, OVEN_EXTRA_TEX.copper, ovenCopper(ovx, ovy));
  upload(textures, OVEN_TEX.bake[0], ovenArt(ovx, ovy, 0));
  upload(textures, OVEN_TEX.bake[1], ovenArt(ovx, ovy, 1));
  for (const defId of Object.keys(FURNITURE) as FurnitureDefId[]) {
    const [ox, oy] = FURNITURE[defId].spriteOrigin;
    upload(textures, defId, FURNITURE_ART[defId](ox, oy, false));
    upload(textures, furnitureTexKey(defId, 2), FURNITURE_ART[defId](ox, oy, true));
  }
}
