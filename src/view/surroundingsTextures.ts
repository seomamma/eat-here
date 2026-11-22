import Phaser from 'phaser';
import type { GroundKind, PropKind } from '../data/surroundings';
import { TILE_H, TILE_W } from './iso';
import { C, Raster, boxes, diamondUV, fromFn, hash, part, upload } from './placeholderTextures';

/**
 * Placeholder art for the outdoor area (M11b): ground diamonds, trees, bushes, flowers, a lamp
 * post and a bench. Same rules as the room art: palette from ART_DIRECTION §4, no anti-aliasing,
 * strict 2:1 edges, a 1 px outline on props (D-027).
 */

const SOIL = ['#6B4A2E', '#5C3A21', '#7A5636'] as const;
const ASPHALT = '#3E434E';
const ASPHALT_SPECK = '#4D5362';
const KERB = '#B09A74';

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
  tree_round: { key: 'prop_tree_round', originX: 16, originY: 55, w: 1, h: 1, corner: false },
  tree_tall: { key: 'prop_tree_tall', originX: 14, originY: 63, w: 1, h: 1, corner: false },
  bush: { key: 'prop_bush', originX: 10, originY: 11, w: 1, h: 1, corner: false },
  bush_flowers: { key: 'prop_bush_flowers', originX: 10, originY: 11, w: 1, h: 1, corner: false },
  flower_red: { key: 'prop_flower_red', originX: 3, originY: 6, w: 1, h: 1, corner: false },
  flower_yellow: { key: 'prop_flower_yellow', originX: 3, originY: 6, w: 1, h: 1, corner: false },
  flower_white: { key: 'prop_flower_white', originX: 3, originY: 6, w: 1, h: 1, corner: false },
  lamp: { key: 'prop_lamp', originX: 16, originY: 46, w: 1, h: 1, corner: true },
  bench: { key: 'prop_bench', originX: 16, originY: 20, w: 2, h: 1, corner: true },
};

// ---------------------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------------------

function grass(variant: number): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    if (!diamondUV(px, py)) return null;
    const n = hash(px, py, 40 + variant);
    if (n < 18) return C.basil4;
    if (n > 975) return C.basil2;
    // A few two-pixel tufts.
    if (hash(px >> 1, py, 70 + variant) < 22 && px % 2 === 0) return C.basil2;
    return C.basil3;
  });
}

function soil(variant: number): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    if (!diamondUV(px, py)) return null;
    const n = hash(px, py, 90 + variant);
    if (n < 70) return SOIL[2];
    if (n > 900) return SOIL[1];
    return SOIL[0];
  });
}

/** Sidewalk pavers; the street-side edge (large j) is a darker kerb. */
function sidewalk(variant: number): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    if (jj >= 15) return KERB;
    if (jj >= 14) return C.cream3;
    if (jj % 8 === 0) return C.cream3; // seam between paver rows
    const joint = (Math.floor(jj / 8) * 8 + variant * 4) % 16;
    if (ii === joint) return C.cream3;
    return hash(px, py, 120 + variant) < 40 ? C.cream1 : C.cream2;
  });
}

function asphalt(variant: number): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    if (!diamondUV(px, py)) return null;
    const n = hash(px, py, 150 + variant);
    if (n < 35) return ASPHALT_SPECK;
    return ASPHALT;
  });
}

/** Street centre row: a dashed line along x (the dash covers the middle of the tile). */
function asphaltLine(): Raster {
  return fromFn(TILE_W, TILE_H, (px, py) => {
    const uv = diamondUV(px, py);
    if (!uv) return null;
    const ii = Math.floor(uv.i * 16);
    const jj = Math.floor(uv.j * 16);
    if ((jj === 7 || jj === 8) && ii >= 2 && ii <= 11) return C.cheese3;
    return hash(px, py, 150) < 35 ? ASPHALT_SPECK : ASPHALT;
  });
}

// ---------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------

/** Adds a 1 px outline around every opaque pixel that touches a transparent one. */
function outlined(r: Raster): Raster {
  const out = new Raster(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const c = r.get(x, y);
      if (!c) continue;
      const edge = !r.get(x - 1, y) || !r.get(x + 1, y) || !r.get(x, y - 1) || !r.get(x, y + 1);
      out.set(x, y, edge ? C.outline : c);
    }
  }
  return out;
}

interface Blob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const inBlob = (b: Blob, x: number, y: number): boolean => {
  const dx = (x + 0.5 - b.cx) / b.rx;
  const dy = (y + 0.5 - b.cy) / b.ry;
  return dx * dx + dy * dy <= 1;
};

/** Leaf colour by lighting from the top left plus a few speckles. */
function leaf(
  b: Blob,
  x: number,
  y: number,
  seed: number,
  shades: readonly [string, string, string, string],
): string {
  const light = ((x + 0.5 - b.cx) / b.rx) * 0.45 + ((y + 0.5 - b.cy) / b.ry) * 0.75;
  const n = hash(x, y, seed);
  if (light < -0.45) return n < 150 ? shades[1] : shades[0];
  if (light < 0.1) return n < 90 ? shades[0] : shades[1];
  if (light < 0.55) return n < 110 ? shades[3] : shades[2];
  return shades[3];
}

const LEAVES = [C.basil4, C.basil3, C.basil2, C.basil1] as const;
const LEAVES_DARK = [C.basil3, C.basil2, C.basil1, '#1B3A21'] as const;

function tree(tall: boolean): Raster {
  const w = tall ? 28 : 32;
  const h = tall ? 64 : 56;
  const r = new Raster(w, h);
  const cx = w / 2;
  // Trunk, then crown blobs.
  const trunkTop = tall ? 44 : 38;
  for (let y = trunkTop; y < h; y++) {
    for (let x = cx - 2; x < cx + 2; x++) r.set(x, y, x < cx ? C.wood3 : C.wood2);
  }
  r.set(cx - 3, h - 1, C.wood2);
  r.set(cx + 2, h - 1, C.wood1);
  const blobs: Blob[] = tall
    ? [
        { cx, cy: 14, rx: 9, ry: 13 },
        { cx, cy: 28, rx: 12, ry: 12 },
        { cx, cy: 40, rx: 8, ry: 6 },
      ]
    : [
        { cx, cy: 20, rx: 15, ry: 17 },
        { cx: cx - 8, cy: 30, rx: 8, ry: 8 },
        { cx: cx + 8, cy: 30, rx: 8, ry: 8 },
      ];
  const shades = tall ? LEAVES_DARK : LEAVES;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const b = blobs.find((bb) => inBlob(bb, x, y));
      if (b) r.set(x, y, leaf(b, x, y, tall ? 7 : 3, shades));
    }
  }
  return outlined(r);
}

function bush(flowers: boolean): Raster {
  const r = new Raster(20, 12);
  const blobs: Blob[] = [
    { cx: 10, cy: 7, rx: 9.5, ry: 5 },
    { cx: 6, cy: 6, rx: 5.5, ry: 5 },
    { cx: 14, cy: 6, rx: 5.5, ry: 5 },
  ];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 20; x++) {
      const b = blobs.find((bb) => inBlob(bb, x, y));
      if (b) r.set(x, y, leaf(b, x, y, 11, LEAVES));
    }
  }
  if (flowers) {
    const dots: [number, number, string][] = [
      [5, 4, C.tomato3],
      [11, 3, C.cheese3],
      [15, 6, C.tomato3],
      [8, 7, C.cheese3],
    ];
    for (const [x, y, c] of dots) r.set(x, y, c);
  }
  return outlined(r);
}

function flower(head: string): Raster {
  const r = new Raster(6, 7);
  r.set(3, 6, C.basil2);
  r.set(3, 5, C.basil2);
  r.set(2, 5, C.basil3);
  r.set(3, 4, C.basil2);
  for (const [x, y] of [
    [3, 0],
    [2, 1],
    [4, 1],
    [3, 2],
  ] as const) {
    r.set(x, y, head);
  }
  r.set(3, 1, C.cheese2);
  return r;
}

/** Lamp post on one tile: thin dark pole, a base and a warm lantern (sprite origin = tile top corner). */
function lamp(): Raster {
  return boxes(1, 1, 16, 46, [
    part({
      i0: 0.34,
      j0: 0.34,
      i1: 0.66,
      j1: 0.66,
      z0: 0,
      z1: 4,
      top: C.cool2,
      left: C.cool1,
      right: C.outline,
    }),
    part({
      i0: 0.44,
      j0: 0.44,
      i1: 0.56,
      j1: 0.56,
      z0: 4,
      z1: 36,
      top: C.cool2,
      left: C.cool1,
      right: C.outline,
    }),
    part({
      i0: 0.3,
      j0: 0.3,
      i1: 0.7,
      j1: 0.7,
      z0: 36,
      z1: 42,
      top: C.cheese3,
      left: C.cheese2,
      right: C.cheese1,
    }),
    part({
      i0: 0.26,
      j0: 0.26,
      i1: 0.74,
      j1: 0.74,
      z0: 42,
      z1: 44,
      top: C.cool2,
      left: C.cool1,
      right: C.outline,
    }),
  ]);
}

/** Park bench two tiles long along x, backrest on the building side, seat facing the street. */
function bench(): Raster {
  const slat = (a: number): string | undefined =>
    Math.floor(a / 3) % 2 === 0 ? undefined : C.wood2;
  return boxes(2, 1, 16, 20, [
    part({
      i0: 0.12,
      j0: 0.22,
      i1: 0.22,
      j1: 0.78,
      z0: 0,
      z1: 7,
      top: C.wood3,
      left: C.wood2,
      right: C.wood1,
    }),
    part({
      i0: 1.78,
      j0: 0.22,
      i1: 1.88,
      j1: 0.78,
      z0: 0,
      z1: 7,
      top: C.wood3,
      left: C.wood2,
      right: C.wood1,
    }),
    part({
      i0: 0.06,
      j0: 0.2,
      i1: 1.94,
      j1: 0.8,
      z0: 7,
      z1: 9,
      top: C.wood4,
      left: C.wood3,
      right: C.wood2,
      decal: (face, a) => (face === 'left' ? slat(a) : undefined),
    }),
    part({
      i0: 0.06,
      j0: 0.2,
      i1: 1.94,
      j1: 0.32,
      z0: 9,
      z1: 15,
      top: C.wood4,
      left: C.wood3,
      right: C.wood2,
      decal: (face, _a, e) =>
        face === 'left' && Math.floor(e / 3) % 2 === 1 ? C.wood2 : undefined,
    }),
  ]);
}

/** Makes every outdoor texture (idempotent, like the room's placeholder art). */
export function generateSurroundingsTextures(textures: Phaser.Textures.TextureManager): void {
  GROUND_TEX.grass.forEach((k, v) => upload(textures, k, grass(v)));
  GROUND_TEX.soil.forEach((k, v) => upload(textures, k, soil(v)));
  GROUND_TEX.sidewalk.forEach((k, v) => upload(textures, k, sidewalk(v)));
  GROUND_TEX.asphalt.forEach((k, v) => upload(textures, k, asphalt(v)));
  upload(textures, GROUND_TEX.asphalt_line[0] ?? '', asphaltLine());
  upload(textures, PROP_TEX.tree_round.key, tree(false));
  upload(textures, PROP_TEX.tree_tall.key, tree(true));
  upload(textures, PROP_TEX.bush.key, bush(false));
  upload(textures, PROP_TEX.bush_flowers.key, bush(true));
  upload(textures, PROP_TEX.flower_red.key, flower(C.tomato3));
  upload(textures, PROP_TEX.flower_yellow.key, flower(C.cheese2));
  upload(textures, PROP_TEX.flower_white.key, flower('#FFFFFF'));
  upload(textures, PROP_TEX.lamp.key, lamp());
  upload(textures, PROP_TEX.bench.key, bench());
}
