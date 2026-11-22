import Phaser from 'phaser';
import { FURNITURE, type FurnitureDefId } from '../data/furniture';
import { TILE_H, TILE_W } from './iso';

/**
 * Isometric placeholder art, generated pixel by pixel (no anti-aliasing, strict 2:1 diagonals).
 *
 * Every shape is rasterised by sampling pixel centres against lines of slope 1/2, which gives
 * exact 2-px-across / 1-px-down steps and tiles seamlessly. Sizes follow ART_DIRECTION §3.
 */

/** World palette subset (ART_DIRECTION §4). */
const C = {
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
export type CharAnim = 'idle' | 'walk' | 'sit' | 'eat';
export const CHAR_ANIMS: readonly CharAnim[] = ['idle', 'walk', 'sit', 'eat'];
export const CHAR_FRAME_COUNT: Record<CharAnim, number> = { idle: 2, walk: 4, sit: 1, eat: 2 };

/**
 * Colour variants: 0 = debug walker, 1..3 = guest variants 0..2 (shirt dark/mid/light, hair).
 * Palette swaps share the same shapes (ART_DIRECTION §7: variants come from palette).
 */
interface CharPalette {
  shirt: readonly [string, string, string];
  hair: string;
}
const CHAR_PALETTES: readonly CharPalette[] = [
  { shirt: [C.tomato1, C.tomato2, C.tomato3], hair: C.wood1 },
  { shirt: [C.cool1, C.cool2, C.cool3], hair: C.wood1 },
  { shirt: [C.basil1, C.basil2, C.basil3], hair: C.cheese1 },
  { shirt: [C.cheese1, C.cheese2, C.cheese3], hair: C.outline },
];
export const CHAR_VARIANT_COUNT = CHAR_PALETTES.length;

export function charTexKey(
  variant: number,
  facing: CharFacing,
  anim: CharAnim,
  frame: number,
): string {
  return `char${variant}_${facing}_${anim}_${frame}`;
}

/** Emote bubbles and coin (16x16 / 7x7). */
export const EMOTE_TEX = { angry: 'emote_angry', happy: 'emote_happy' } as const;
export const COIN_TEX = 'coin';
export const EMOTE_SIZE = 16;
export const COIN_SIZE = 7;

type Pixel = string | null;

/** Pixel buffer with hex colours; null = transparent. */
class Raster {
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
function upload(textures: Phaser.Textures.TextureManager, key: string, r: Raster): void {
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

function fromFn(w: number, h: number, fn: (x: number, y: number) => Pixel): Raster {
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r.set(x, y, fn(x, y));
  return r;
}

/** Cheap deterministic hash for speckles (no RNG state; art only). */
function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
}

// ---------------------------------------------------------------------------------------
// Floors: 32x16 diamonds
// ---------------------------------------------------------------------------------------

/** Tile-local coordinates (i along x, j along y, both 0..1) of a 32x16 diamond pixel, or null outside. */
function diamondUV(px: number, py: number): { i: number; j: number } | null {
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
function backWall(side: 'l' | 'r', end: boolean): Raster {
  const right = side === 'r';
  const cap = right ? C.cream2 : C.cream1;
  const face = right ? C.cream3 : C.cream2;
  const faceShade = right ? '#B09A74' : C.cream3;
  const brick = right ? C.brick1 : C.brick2;
  const brickHi = right ? C.brick2 : C.brick3;
  const mortar = right ? '#5E2217' : C.brick1;
  return fromFn(WALL_BACK_W, WALL_BACK_H, (tx, ty) => {
    const top = right ? Math.floor(tx / 2) : Math.floor((WALL_BACK_W - 1 - tx) / 2);
    const d = ty - top;
    if (d < 0 || d > WALL_BACK_RISE - 1) return null;
    if (end && tx === (right ? WALL_BACK_W - 1 : 0)) return C.outline;
    if (d === 0 || d === WALL_BACK_RISE - 1) return C.outline;
    if (d <= 2) return cap;
    if (d === 3) return faceShade;
    if (d === 30) return C.wood2; // chair rail
    if (d === 31) return C.wood1;
    if (d > 31) {
      const row = d - 32; // 0..7
      if (row === 0) return brickHi;
      if (row % 4 === 3) return mortar;
      const off = Math.floor(row / 4) % 2 === 0 ? 0 : 4;
      return (tx + off) % 8 === 0 ? mortar : brick;
    }
    // Plaster with faint vertical panelling.
    return tx % 8 === 0 ? faceShade : face;
  });
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
// Characters: 16x24, two facings (front = down-right, back = up-right; the others are mirrored)
// ---------------------------------------------------------------------------------------

/** Crude placeholder person: head, torso, two legs, dark outline, feet on the last row. */
function characterFrame(
  variant: number,
  facing: CharFacing,
  anim: CharAnim,
  frame: number,
): Raster {
  const pal = CHAR_PALETTES[variant] ?? (CHAR_PALETTES[0] as CharPalette);
  const [shirt1, shirt2, shirt3] = pal.shirt;
  const fill = new Raster(CHAR_W, CHAR_H);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fill.set(x, y, c);
  };
  const front = facing === 'front';
  const walking = anim === 'walk';
  const sitting = anim === 'sit' || anim === 'eat';
  // Upper body drops 1 px on contact frames (walk 0/2) and on the second idle frame (breathing).
  // Seated: the whole body sits lower (legs are folded under the table).
  let bob = walking ? (frame % 2 === 0 ? 1 : 0) : frame === 1 && anim === 'idle' ? 1 : 0;
  if (sitting) bob = 5;
  // Legs: [leftTop, rightTop, leftX, rightX] (a lifted foot ends higher).
  let leftEnd = 23;
  let rightEnd = 23;
  let leftX = 4;
  let rightX = 9;
  if (walking) {
    if (frame === 0) [leftX, rightX] = [3, 10];
    if (frame === 1) leftEnd = 21;
    if (frame === 2) [leftX, rightX] = [3, 10];
    if (frame === 3) rightEnd = 21;
  }
  if (sitting) {
    // Thighs/knees only, resting on the seat.
    rect(4, 21, 11, 23, C.cool1);
    rect(4, 23, 5, 23, C.wood1);
    rect(10, 23, 11, 23, C.wood1);
  } else {
    rect(leftX, 18, leftX + 2, leftEnd, C.cool1);
    rect(rightX, 18, rightX + 2, rightEnd, C.cool1);
    rect(leftX, leftEnd - 1, leftX + 2, leftEnd, C.wood1); // shoes
    rect(rightX, rightEnd - 1, rightX + 2, rightEnd, C.wood1);
  }
  // Torso and arms.
  const torsoEnd = sitting ? 20 : 17;
  rect(4, 10 + bob, 11, torsoEnd, shirt2);
  rect(3, 11 + bob, 3, torsoEnd - 1, shirt3);
  rect(12, 11 + bob, 12, torsoEnd - 1, shirt1);
  if (front) rect(6, 13 + bob, 10, torsoEnd, C.cream1); // apron
  if (anim === 'eat' && frame === 1) {
    // Hand with food raised to the mouth.
    rect(9, 10 + bob, 11, 11 + bob, C.wood4);
    rect(10, 9 + bob, 11, 9 + bob, C.cheese2);
  } else if (sitting) {
    // Hands resting on the table edge.
    rect(3, 19, 4, 19, C.wood4);
    rect(11, 19, 12, 19, C.wood4);
  }
  // Head and hair.
  rect(4, 2 + bob, 11, 9 + bob, C.wood4);
  if (front) {
    rect(4, 2 + bob, 11, 4 + bob, pal.hair);
    rect(4, 5 + bob, 4, 6 + bob, pal.hair);
    fill.set(7, 6 + bob, C.outline);
    fill.set(10, 6 + bob, C.outline);
  } else {
    rect(4, 2 + bob, 11, 8 + bob, pal.hair);
    rect(5, 9 + bob, 10, 9 + bob, C.wood2);
  }
  // Outline: every filled pixel touching transparency.
  const r = new Raster(CHAR_W, CHAR_H);
  for (let y = 0; y < CHAR_H; y++) {
    for (let x = 0; x < CHAR_W; x++) {
      const c = fill.get(x, y);
      if (!c) continue;
      const edge =
        !fill.get(x - 1, y) || !fill.get(x + 1, y) || !fill.get(x, y - 1) || !fill.get(x, y + 1);
      r.set(x, y, edge ? C.outline : c);
    }
  }
  return r;
}

/** 16x16 speech bubble with a tail, pixel face inside. */
function emoteBubble(kind: 'angry' | 'happy'): Raster {
  const bg = kind === 'angry' ? C.tomato2 : C.cheese3;
  const fg = kind === 'angry' ? C.cream1 : C.outline;
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
  if (kind === 'angry') {
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
  } else {
    // Happy closed eyes and a smile.
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

// ---------------------------------------------------------------------------------------
// Furniture: isometric boxes
// ---------------------------------------------------------------------------------------

type Face = 'top' | 'left' | 'right';

interface Part {
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
function part(p: Omit<Part, 'decal'> & { decal?: Part['decal'] }): Part {
  return p;
}

/** Rasterises painter-ordered boxes with a per-part 1px outline. `o` = top corner pixel. */
function boxes(w: number, h: number, ox: number, oy: number, parts: Part[]): Raster {
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

type FurnitureArt = (ox: number, oy: number) => Raster;

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
  chair_wood: (ox, oy) =>
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
      // Backrest on the -x side (faces +x).
      part({
        i0: 0.16,
        j0: 0.16,
        i1: 0.3,
        j1: 0.84,
        z0: 8,
        z1: 18,
        top: C.wood4,
        left: C.wood3,
        right: C.wood2,
      }),
    ]),
  oven_pizza: (ox, oy) =>
    boxes(2, 1, ox, oy, [
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
          if (face === 'left') {
            // Glowing mouth on the +y face the chef stands in front of.
            const dx = Math.abs(a - 16);
            if (dx < 7 && e < 9 && e >= 1) {
              if (dx < 4 && e < 6) return e < 3 ? C.cheese3 : e < 4.5 ? C.cheese2 : C.tomato2;
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
    ]),
  counter_pass: (ox, oy) =>
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
          if (face === 'left' && e > 2 && e < 9 && a % 16 > 2 && a % 16 < 14) return C.wood2;
          return undefined;
        },
      }),
      // Warming plates on top.
      part({
        i0: 0.25,
        j0: 0.3,
        i1: 0.65,
        j1: 0.7,
        z0: 11,
        z1: 13,
        top: C.cheese3,
        left: C.cheese2,
        right: C.cheese1,
      }),
      part({
        i0: 1.2,
        j0: 0.3,
        i1: 1.7,
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
};

/** Generates every placeholder texture at real pixel sizes. Idempotent. */
export function generatePlaceholderTextures(textures: Phaser.Textures.TextureManager): void {
  upload(textures, TEX.floorWood[0], woodFloor(0));
  upload(textures, TEX.floorWood[1], woodFloor(1));
  upload(textures, TEX.floorTile, drawFloorTile());
  upload(textures, TEX.doorMat, drawDoorMat());
  upload(textures, TEX.doorFrame, doorFrame());
  upload(textures, TEX.wallBackL, backWall('l', false));
  upload(textures, TEX.wallBackLEnd, backWall('l', true));
  upload(textures, TEX.wallBackR, backWall('r', false));
  upload(textures, TEX.wallBackREnd, backWall('r', true));
  upload(textures, TEX.wallFrontL, lowWall('l'));
  upload(textures, TEX.wallFrontR, lowWall('r'));
  upload(textures, TEX.tileHighlight, drawHighlight());
  for (let v = 0; v < CHAR_VARIANT_COUNT; v++) {
    for (const facing of ['front', 'back'] as const) {
      for (const anim of CHAR_ANIMS) {
        for (let f = 0; f < CHAR_FRAME_COUNT[anim]; f++) {
          upload(textures, charTexKey(v, facing, anim, f), characterFrame(v, facing, anim, f));
        }
      }
    }
  }
  upload(textures, EMOTE_TEX.angry, emoteBubble('angry'));
  upload(textures, EMOTE_TEX.happy, emoteBubble('happy'));
  upload(textures, COIN_TEX, coin());
  for (const defId of Object.keys(FURNITURE) as FurnitureDefId[]) {
    const [ox, oy] = FURNITURE[defId].spriteOrigin;
    upload(textures, defId, FURNITURE_ART[defId](ox, oy));
  }
}
