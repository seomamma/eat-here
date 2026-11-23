// Outdoor art (M13b): ground tiles (grass, soil, sidewalk, street), trees, bushes, flowers,
// lamp post (+ night glow frame) and bench. Palette chars only.
import { Grid, blobs, boxes, hash, part, plot, GOLD, proj } from './iso.mjs';
import { spriteText } from './lib.mjs';

// ---- ground tiles ---------------------------------------------------------------------------
function diamondUV(px, py) {
  const X = px + 0.5 - 16;
  const Y = py + 0.5;
  const i = (X / 16 + Y / 8) / 2;
  const j = (Y / 8 - X / 16) / 2;
  return i >= 0 && i < 1 && j >= 0 && j < 1 ? { i, j } : null;
}
function ground(fn) {
  const g = new Grid(32, 16);
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 32; px++) {
      const uv = diamondUV(px, py);
      if (uv) g.set(px, py, fn(px, py, Math.floor(uv.i * 16), Math.floor(uv.j * 16)));
    }
  return g.rows();
}

const grass = (v) =>
  ground((px, py) => {
    const n = hash(px, py, 40 + v);
    // two-pixel blades (a lit tip over a dark foot) on a flat basil base
    if (hash(px >> 1, py, 70 + v) < 55 && px % 2 === 0) return 'q';
    if (hash(px, py + 1, 70 + v) < 40 && px % 2 === 0) return 's';
    if (n < 28) return 's';
    if (n > 962) return 'q';
    return 'r';
  });
const soil = (v) =>
  ground((px, py) => {
    const n = hash(px, py, 90 + v);
    if (n < 55) return 'b';
    if (n > 930) return 'k';
    if (hash(px >> 1, py, 5 + v) < 60) return 'c';
    return 'a';
  });
/** Sidewalk: cream pavers on a 8x8 grid in tile space; the street-side edge (jj >= 14) is a kerb. */
const sidewalk = (v) =>
  ground((px, py, ii, jj) => {
    if (jj >= 14) return jj === 14 ? 'j' : 'b';
    if (ii % 8 === 0 || (jj + 4) % 8 === 0) return 'j';
    const n = hash(px, py, 120 + v);
    if (n < 70) return 'h';
    if (n > 940) return 'j';
    return 'i';
  });
const asphalt = (v) =>
  ground((px, py) => {
    const n = hash(px, py, 150 + v);
    if (n < 40) return 'P';
    if (n > 985) return 'k';
    return 'O';
  });
const asphaltLine = () =>
  ground((px, py, ii, jj) => {
    if (jj >= 7 && jj <= 8 && ii >= 2 && ii <= 13) return ii === 2 || ii === 13 ? 'i' : 'h';
    const n = hash(px, py, 150);
    if (n < 40) return 'P';
    if (n > 985) return 'k';
    return 'O';
  });

// ---- plants ---------------------------------------------------------------------------------
const LEAF = ['p', 'q', 'r', 's'];
const LEVELS = [0.02, 0.24, 0.48];
const leafTex = (info) => {
  const n = hash(info.px, info.py, 21);
  if (info.lvl >= 2 && n < 120) return 's';
  if (info.lvl <= 1 && n < 140) return 'p';
  return undefined;
};

/** Draws blob clusters for an organic prop on a free-size grid; feet at (cx, feetY). */
function organic(W, H, cx, feetY, clusters, extra) {
  const levels = extra?.levels ?? LEVELS;
  const g = new Grid(W, H);
  extra?.pre?.(g);
  // Tile centre (0.5, 0.5) sits at (cx, feetY); the iso origin (tile top corner) is 8 px above.
  blobs({ ox: cx, oy: feetY - 8, levels, sort: [0, 0, 0], clusters }).draw(g);
  extra?.post?.(g);
  return g;
}

const trunk = (g, cx, y0, y1, w = 4) => {
  for (let y = y0; y <= y1; y++)
    for (let x = cx - w / 2; x < cx + w / 2; x++) g.set(x, y, x < cx ? 'c' : 'b');
  for (let y = y0; y <= y1; y++) {
    g.set(cx - w / 2 - 1, y, 'k');
    g.set(cx + w / 2, y, 'k');
  }
  g.set(cx - w / 2 - 1, y1 + 1, 'k');
  g.set(cx + w / 2, y1 + 1, 'k');
  g.rect(cx - w / 2, y1 + 1, cx + w / 2 - 1, y1 + 1, 'k');
  g.set(cx - w / 2 - 1, y1, 'b');
  g.set(cx + w / 2, y1, 'a');
};

function treeRound() {
  const W = 40;
  const H = 56;
  const cx = 20;
  const feet = 53;
  const mk = (ci, cj, cz, ri, rj, rz) => ({ ci, cj, cz, ri, rj, rz, ramp: LEAF, tex: leafTex });
  return organic(
    W, H, cx, feet,
    [
      mk(0.5, 0.5, 32, 0.72, 0.72, 12),
      mk(0.18, 0.66, 28, 0.5, 0.5, 9),
      mk(0.82, 0.34, 29, 0.5, 0.5, 9),
      mk(0.5, 0.5, 41, 0.52, 0.52, 9),
    ],
    { pre: (g) => trunk(g, cx, feet - 28, feet - 1, 4) },
  );
}
function treeTall() {
  const W = 32;
  const H = 70;
  const cx = 16;
  const feet = 67;
  const mk = (ci, cj, cz, ri, rj, rz) => ({ ci, cj, cz, ri, rj, rz, ramp: ['p', 'p', 'q', 'r'], tex: leafTex });
  return organic(
    W, H, cx, feet,
    [
      mk(0.5, 0.5, 30, 0.48, 0.48, 12),
      mk(0.5, 0.5, 44, 0.4, 0.4, 14),
      mk(0.5, 0.5, 58, 0.26, 0.26, 12),
    ],
    { pre: (g) => trunk(g, cx, feet - 14, feet - 1, 3) },
  );
}
function bush(flowers) {
  const W = 24;
  const H = 16;
  const cx = 12;
  const feet = 13;
  const mk = (ci, cj, cz, ri, rj, rz) => ({ ci, cj, cz, ri, rj, rz, ramp: LEAF, tex: leafTex });
  return organic(
    W, H, cx, feet,
    [mk(0.5, 0.5, 5, 0.56, 0.52, 6), mk(0.25, 0.62, 4, 0.36, 0.36, 5), mk(0.75, 0.4, 4, 0.36, 0.36, 5)],
    {
      levels: [0.12, 0.38, 0.62],
      post: flowers
        ? (g) => {
            const dots = [[7, 6, 'n'], [12, 4, 'v'], [16, 7, 'n'], [10, 9, 'W'], [14, 10, 'v']];
            for (const [x, y, c] of dots) g.set(x, y, c);
          }
        : undefined,
    },
  );
}
// 8x9 + outline would exceed; draw flowers on 10x11.
function flowerSprite(head, centre) {
  const base = new Grid(10, 11);
  base.put(3, 1, ['.PP.', 'PCCP', 'PCCP', '.PP.'].map((r) => r));
  base.put(4, 5, ['q', 'q', 'q']);
  base.set(3, 6, 'q');
  base.set(5, 7, 'q');
  base.set(5, 6, 'r');
  const g = new Grid(10, 11);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 10; x++) {
      const c = base.get(x, y);
      g.set(x, y, c === 'P' ? head : c === 'C' ? centre : c);
    }
  // single pixel outline only around the bloom, none around the stem
  const withOutline = new Grid(10, 11);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 10; x++) withOutline.set(x, y, g.get(x, y));
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 10; x++) {
      if (g.get(x, y) !== '.') continue;
      if (['P', 'C'].some(() => false)) continue;
      const near = [g.get(x - 1, y), g.get(x + 1, y), g.get(x, y - 1), g.get(x, y + 1)].some((c) => c === head || c === centre);
      if (near) withOutline.set(x, y, 'k');
    }
  return withOutline;
}

// ---- lamp post and bench --------------------------------------------------------------------
function lampPost(lit = false) {
  const ox = 16;
  const oy = 46;
  const metal = { top: 'K', left: 'x', right: 'w' };
  return boxes(1, 1, ox, oy, [
    part({ i0: 0.3, j0: 0.3, i1: 0.7, j1: 0.7, z0: 0, z1: 4, ...metal }),
    part({ i0: 0.4, j0: 0.4, i1: 0.6, j1: 0.6, z0: 4, z1: 7, ...metal }),
    part({ i0: 0.45, j0: 0.45, i1: 0.55, j1: 0.55, z0: 7, z1: 38, top: 'K', left: 'x', right: 'w' }),
    // Lantern: warm glass box with a dark cap.
    part({ i0: 0.3, j0: 0.3, i1: 0.7, j1: 0.7, z0: 38, z1: 41, top: 'x', left: 'x', right: 'w' }),
    part({
      i0: 0.34, j0: 0.34, i1: 0.66, j1: 0.66, z0: 41, z1: 48,
      top: 'v', left: lit ? 'W' : 'v', right: lit ? 'v' : 'u',
      decal: (face, a, e) => (face !== 'top' && (a < 1 || e < 1) ? 'u' : undefined),
    }),
    part({ i0: 0.28, j0: 0.28, i1: 0.72, j1: 0.72, z0: 48, z1: 51, top: 'K', left: 'x', right: 'w' }),
    plot((g) => g.set(ox, oy - 41, 'k')),
  ]);
}

function bench() {
  const ox = 16;
  const oy = 24;
  return boxes(2, 1, ox, oy, [
    // legs
    part({ i0: 0.1, j0: 0.2, i1: 0.2, j1: 0.8, z0: 0, z1: 9, top: 'K', left: 'x', right: 'w' }),
    part({ i0: 1.8, j0: 0.2, i1: 1.9, j1: 0.8, z0: 0, z1: 9, top: 'K', left: 'x', right: 'w' }),
    // seat: two slats
    part({
      i0: 0.04, j0: 0.28, i1: 1.96, j1: 0.72, z0: 9, z1: 12,
      top: 'd', left: 'c', right: 'b',
      decal: (face, a, e) => (face === 'top' && Math.abs(e - 0.5) < 0.04 ? 'b' : face === 'left' && e > 1.5 && e < 2 ? 'b' : undefined),
    }),
    // backrest
    part({
      i0: 0.04, j0: 0.28, i1: 1.96, j1: 0.38, z0: 12, z1: 21,
      top: 'd', left: 'c', right: 'b',
      decal: (face, a, e) => (face !== 'top' && Math.floor(e / 3) % 2 === 1 ? 'b' : undefined),
    }),
  ]);
}

/** Warm glow for night: dithered halo around (cx, cy) and a pool on the ground at (px, py). */
export function glow(W, H, cx, cy, halo, px, py, pool) {
  const g = new Grid(W, H);
  const put = (x, y, c) => {
    if (g.get(x, y) === '.') g.set(x, y, c);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.1);
      if (d < 3.2) put(x, y, 'W');
      else if (d < 5) put(x, y, 'v');
      else if (d < halo * 0.62) put(x, y, (x + y) % 2 === 0 ? 'v' : '.');
      else if (d < halo * 0.85) put(x, y, x % 2 === 0 && y % 2 === 0 ? 'u' : '.');
      const dp = Math.hypot((x - px) / pool.rx, (y - py) / pool.ry);
      if (dp < 0.5) put(x, y, (x + y) % 2 === 0 ? 'v' : '.');
      else if (dp < 1) put(x, y, x % 2 === 0 && y % 2 === 0 ? 'u' : '.');
    }
  return g.rows();
}

export function outdoorText() {
  const still = (rows) => [{ name: 'still', dir: 'none', fps: 1, frames: [rows] }];
  const hdr = (n, w, h, px, py, kind) => `sprite ${n} ${w}x${h} pivot ${px},${py} kind ${kind}`;
  const gnd = (n, rows) => spriteText(hdr(n, 32, 16, 0, 0, 'floor'), still(rows));
  const prop = (n, g, px, py) => spriteText(hdr(n, g.w, g.h, px, py, 'prop'), still(g.rows()));
  const ground = [
    ...[0, 1, 2].map((v) => gnd(`ground_grass_${v}`, grass(v))),
    ...[0, 1].map((v) => gnd(`ground_soil_${v}`, soil(v))),
    ...[0, 1].map((v) => gnd(`ground_sidewalk_${v}`, sidewalk(v))),
    ...[0, 1].map((v) => gnd(`ground_asphalt_${v}`, asphalt(v))),
    gnd('ground_asphalt_line', asphaltLine()),
  ].join('\n');
  const lampLit = lampPost(true);
  const props = [
    prop('prop_tree_round', treeRound(), 20, 53),
    prop('prop_tree_tall', treeTall(), 16, 67),
    prop('prop_bush', bush(false), 12, 13),
    prop('prop_bush_flowers', bush(true), 12, 13),
    prop('prop_flower_red', flowerSprite('n', 'u'), 4, 10),
    prop('prop_flower_yellow', flowerSprite('u', 'm'), 4, 10),
    prop('prop_flower_white', flowerSprite('W', 'u'), 4, 10),
    prop('prop_lamp', lampPost(false), 16, 46),
    prop('prop_bench', bench(), 16, 24),
    spriteText(hdr('glow_lamp', 56, 72, 28, 52, 'prop'), still(glow(56, 72, 28, 22, 20, 28, 60, { rx: 20, ry: 9 }))),
  ].join('\n');
  void lampLit;
  return { ground, props };
}

void GOLD;
void proj;
