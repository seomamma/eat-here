// Draft generator for the room and the core furniture (assets/sprites/world/*.px).
// Geometry follows ART_DIRECTION §2/§3 (2:1 iso). Colours are palette chars.
import { Grid, spriteText, writePx } from './lib.mjs';

const still = (rows, dir = 'none') => [{ name: 'still', dir, fps: 1, frames: [rows] }];
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
};

// ---- floors ---------------------------------------------------------------------------------
function diamondUV(px, py) {
  const X = px + 0.5 - 16;
  const Y = py + 0.5;
  const i = (X / 16 + Y / 8) / 2;
  const j = (Y / 8 - X / 16) / 2;
  return i >= 0 && i < 1 && j >= 0 && j < 1 ? { i, j } : null;
}
function floor(fn) {
  const g = new Grid(32, 16);
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 32; px++) {
      const uv = diamondUV(px, py);
      if (!uv) continue;
      g.set(px, py, fn(px, py, Math.floor(uv.i * 16), Math.floor(uv.j * 16)));
    }
  return g.rows();
}
const woodFloor = (v) =>
  floor((px, py, ii, jj) => {
    const plank = Math.floor(jj / 4);
    if (jj % 4 === 0) return 'b';
    if (ii === (plank * 5 + v * 7) % 16) return 'b';
    const n = hash(px, py, v);
    // per-plank tone shift keeps the boards distinct; grain streaks run along x.
    const tone = (plank * 3 + v) % 4 === 0 ? 'd' : 'c';
    if (jj % 4 === 1 && n < 380) return tone === 'c' ? 'd' : 'c'; // lit upper edge of the board
    if (n < 30) return 'd';
    if (n > 955) return 'b';
    return tone;
  });
const checkerFloor = () =>
  floor((px, py, ii, jj) => {
    if (ii % 8 === 0 || jj % 8 === 0) return 'y';
    const a = (Math.floor(ii / 8) + Math.floor(jj / 8)) % 2 === 0;
    if (ii % 8 === 1 && jj % 8 === 1) return 'W';
    return a ? 'z' : 'y';
  });
const terracottaFloor = () =>
  floor((px, py, ii, jj) => {
    if (ii % 8 === 0 || jj % 8 === 0) return 'j';
    const n = hash(px, py, 7);
    if (n < 50) return 'f';
    const a = (Math.floor(ii / 8) + Math.floor(jj / 8)) % 2 === 0;
    if (ii % 8 === 1 || jj % 8 === 1) return 'g';
    return a ? 'n' : 'g';
  });
const herringboneFloor = () =>
  floor((px, py, ii, jj) => {
    const flip = (Math.floor(ii / 4) + Math.floor(jj / 4)) % 2 === 0;
    const along = flip ? jj : ii;
    const across = flip ? ii : jj;
    if (along % 2 === 0) return 'b';
    if (across % 4 === 0 && along % 4 === 1) return 'b';
    return hash(px, py, 3) < 80
      ? 'h'
      : (Math.floor(along / 2) + Math.floor(ii / 4)) % 2 === 0
        ? 'd'
        : 'i';
  });
const doorMat = () =>
  floor((px, py, ii, jj) => {
    if (ii < 3 || ii > 12 || jj < 3 || jj > 12) return 'y';
    if (ii < 4 || ii > 11 || jj < 4 || jj > 11) return 'w';
    if ((ii === 5 || ii === 10) && jj > 5 && jj < 10) return 'h';
    return jj % 4 === 0 ? 'g' : 'f';
  });

// ---- walls ----------------------------------------------------------------------------------
const RISE = 41;
function backWall(side, end, style) {
  const right = side === 'r';
  const cap = right ? 'i' : 'h';
  const face = right ? 'j' : 'i';
  const faceShade = right ? 'b' : 'j';
  const g = new Grid(16, 48);
  const brickRow = (tx, row) => {
    if (row === 0) return right ? 'f' : 'g';
    if (row % 4 === 3) return right ? 'a' : 'e';
    const off = Math.floor(row / 4) % 2 === 0 ? 0 : 4;
    if ((tx + off) % 8 === 0) return right ? 'a' : 'e';
    return hash(tx, row, 5) < 120 ? (right ? 'e' : 'g') : right ? 'e' : 'f';
  };
  for (let tx = 0; tx < 16; tx++) {
    const top = right ? Math.floor(tx / 2) : Math.floor((15 - tx) / 2);
    for (let ty = 0; ty < 48; ty++) {
      const d = ty - top;
      if (d < 0 || d > RISE - 1) continue;
      let c;
      if (end && tx === (right ? 15 : 0)) c = 'k';
      else if (d === 0 || d === RISE - 1) c = 'k';
      else if (d <= 2) c = cap;
      else if (d === 3) c = faceShade;
      else if (style === 'brick') c = brickRow(tx, d - 4);
      else if (style === 'green_stripes') {
        if (d === 30) c = 'c';
        else if (d === 31) c = 'a';
        else if (d > 31) c = tx % 4 === 0 ? 'a' : tx % 4 === 3 ? 'c' : 'b';
        else c = Math.floor(tx / 2) % 2 === 0 ? (right ? 'q' : 'r') : right ? 'p' : 'q';
      } else if (style === 'blue_tiles') {
        if (d === 30) c = 'z';
        else if (d === 31) c = 'w';
        else {
          const grout = right ? 'w' : 'x';
          const tile = d > 31 ? (right ? 'x' : 'y') : right ? 'y' : 'z';
          c = tx % 4 === 0 || d % 4 === 0 ? grout : tile;
          if (tx % 4 === 1 && d % 4 === 1 && d > 31) c = right ? 'y' : 'z';
        }
      } else if (d === 30) c = 'c';
      else if (d === 31) c = 'a';
      else if (d > 31) c = brickRow(tx, d - 32);
      else c = tx % 8 === 0 ? faceShade : hash(tx, d, 9) < 25 ? (right ? 'i' : 'h') : face;
      g.set(tx, ty, c);
    }
  }
  return g.rows();
}
function lowWall(side) {
  const left = side === 'l';
  const g = new Grid(16, 12);
  for (let tx = 0; tx < 16; tx++) {
    const top = left ? Math.floor(tx / 2) : 7 - Math.floor(tx / 2);
    for (let d = 0; d <= 4; d++) {
      let c;
      if (d === 0 || d === 4) c = 'k';
      else if (d === 1) c = left ? 'h' : 'i';
      else c = d === 2 ? (left ? 'g' : 'f') : left ? 'f' : 'e';
      g.set(tx, top + d, c);
    }
  }
  return g.rows();
}
function doorFrame() {
  const g = new Grid(16, 40);
  const base = (tx) => 32 + Math.floor(tx / 2);
  const fill = new Grid(16, 40);
  for (let tx = 0; tx < 16; tx++) {
    const post = tx < 4 || tx >= 12;
    for (let ty = base(tx) - 27; ty <= base(tx); ty++) {
      const lintel = ty <= base(tx) - 27 + 3;
      if (!post && !lintel) continue;
      let c;
      if (lintel) c = ty === base(tx) - 27 ? 'd' : ty === base(tx) - 27 + 3 ? 'b' : 'c';
      else c = tx % 4 === 0 ? 'd' : tx % 4 === 3 ? 'a' : 'b';
      fill.set(tx, ty, c);
    }
  }
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 16; x++) {
      const c = fill.get(x, y);
      if (c === '.') continue;
      const edge =
        fill.get(x - 1, y) === '.' ||
        fill.get(x + 1, y) === '.' ||
        fill.get(x, y - 1) === '.' ||
        fill.get(x, y + 1) === '.';
      g.set(x, y, edge ? 'k' : c);
    }
  return g.rows();
}

// ---- iso box rasteriser (port of the placeholder one, palette chars) --------------------------
function boxes(w, h, ox, oy, parts, post) {
  const W = (w + h) * 16;
  const H = oy + (w + h) * 8;
  const r = new Grid(W, H);
  const sorted = [...parts].sort((a, b) => a.i0 + a.j0 + a.z0 / 64 - (b.i0 + b.j0 + b.z0 / 64));
  for (const p of sorted) {
    if (p.draw) {
      p.draw(r);
      continue;
    }
    const mask = new Grid(W, H);
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const X = px + 0.5 - ox;
        const Y = py + 0.5 - oy;
        const Yt = Y + p.z1;
        const it = (X / 16 + Yt / 8) / 2;
        const jt = (Yt / 8 - X / 16) / 2;
        let c;
        if (it >= p.i0 && it < p.i1 && jt >= p.j0 && jt < p.j1)
          c = p.decal?.('top', it, jt, px, py) ?? p.top;
        else {
          const il = X / 16 + p.j1;
          const el = (il + p.j1) * 8 - Y;
          if (il >= p.i0 && il < p.i1 && el >= p.z0 && el < p.z1)
            c = p.decal?.('left', (il - p.i0) * 16, el - p.z0, px, py) ?? p.left;
          else {
            const jr = p.i1 - X / 16;
            const er = (p.i1 + jr) * 8 - Y;
            if (jr >= p.j0 && jr < p.j1 && er >= p.z0 && er < p.z1)
              c = p.decal?.('right', (jr - p.j0) * 16, er - p.z0, px, py) ?? p.right;
          }
        }
        if (c) mask.set(px, py, c);
      }
    for (let py = 0; py < H; py++)
      for (let px = 0; px < W; px++) {
        const c = mask.get(px, py);
        if (c === '.') continue;
        const edge =
          mask.get(px - 1, py) === '.' ||
          mask.get(px + 1, py) === '.' ||
          mask.get(px, py - 1) === '.' ||
          mask.get(px, py + 1) === '.';
        r.set(px, py, edge ? 'k' : c);
      }
  }
  post?.(r);
  return r;
}
const part = (p) => p;
const legs = (i0, j0, i1, j1, z1, t = 0.14) =>
  [
    [i0, j0],
    [i1 - t, j0],
    [i0, j1 - t],
    [i1 - t, j1 - t],
  ].map(([i, j]) =>
    part({ i0: i, j0: j, i1: i + t, j1: j + t, z0: 0, z1, top: 'c', left: 'b', right: 'a' }),
  );

// ---- furniture ------------------------------------------------------------------------------
const OR = { chair: [16, 19], table: [16, 15], pass: [16, 15], oven: [16, 23] };

function chair(back) {
  return boxes(1, 1, ...OR.chair, [
    ...legs(0.2, 0.2, 0.8, 0.8, 5, 0.12),
    part({
      i0: 0.16,
      j0: 0.16,
      i1: 0.84,
      j1: 0.84,
      z0: 5,
      z1: 8,
      top: 'd',
      left: 'c',
      right: 'b',
      decal: (face, a, e) =>
        face === 'top'
          ? hash(Math.floor(a * 10), Math.floor(e * 10), 4) < 90
            ? 'c'
            : undefined
          : undefined,
    }),
    // Backrest: two slats with a gap, light on top.
    part({
      i0: 0.16,
      j0: back ? 0.7 : 0.16,
      i1: 0.84,
      j1: back ? 0.84 : 0.3,
      z0: 8,
      z1: 19,
      top: 'd',
      left: 'c',
      right: 'b',
      decal: (face, a, e) => (face !== 'top' && e > 4 && e < 6 ? 'b' : undefined),
    }),
  ]);
}

function table() {
  return boxes(1, 1, ...OR.table, [
    ...legs(0.12, 0.12, 0.88, 0.88, 9),
    part({
      i0: 0.06,
      j0: 0.06,
      i1: 0.94,
      j1: 0.94,
      z0: 9,
      z1: 12,
      top: 'm',
      left: 'l',
      right: 'e',
      decal: (face, a, e) => {
        if (face === 'top') {
          const di = Math.abs(a - 0.5);
          const dj = Math.abs(e - 0.5);
          if (di < 0.17 && dj < 0.17) return di < 0.12 && dj < 0.12 ? 'h' : 'i'; // white cloth square
          if (a < 0.1 || e < 0.1) return 'n'; // lit table edge
          return undefined;
        }
        return e < 1 ? 'a' : undefined; // wood apron under the slab
      },
    }),
  ]);
}

function pass(back) {
  return boxes(2, 1, ...OR.pass, [
    part({
      i0: 0,
      j0: 0.1,
      i1: 2,
      j1: 0.9,
      z0: 0,
      z1: 11,
      top: 'h',
      left: 'c',
      right: 'b',
      decal: (face, a, e) => {
        if (face === 'top') return undefined;
        if (!back && face === 'left') {
          if (e < 1.5) return 'a'; // plinth
          if (e > 2.5 && e < 9.5 && a % 16 > 2 && a % 16 < 14)
            return e > 8.5 || a % 16 < 3.5 ? 'd' : 'b';
          if (e > 4.5 && e < 6 && a % 16 > 11 && a % 16 < 13) return 'u'; // brass handle
          return undefined;
        }
        if (back && face === 'left' && e > 6 && e < 8) return 'b';
        return undefined;
      },
    }),
    // Ticket rail on the chef side: a dark bar with a ticket.
    part({
      i0: back ? 1.1 : 0.15,
      j0: back ? 0.65 : 0.12,
      i1: back ? 1.9 : 0.95,
      j1: back ? 0.8 : 0.26,
      z0: 11,
      z1: 13,
      top: 'x',
      left: 'w',
      right: 'w',
    }),
    part({
      i0: back ? 1.25 : 0.4,
      j0: back ? 0.66 : 0.13,
      i1: back ? 1.4 : 0.55,
      j1: back ? 0.7 : 0.17,
      z0: 13,
      z1: 16,
      top: 'h',
      left: 'h',
      right: 'i',
    }),
    // Warming plate on the waiter side.
    part({
      i0: back ? 0.35 : 1.2,
      j0: 0.3,
      i1: back ? 0.85 : 1.7,
      j1: 0.7,
      z0: 11,
      z1: 12,
      top: 'v',
      left: 'u',
      right: 't',
    }),
  ]);
}

/** Half-ellipsoid dome with brick courses, lit from the top-left. */
function dome(c) {
  return {
    i0: 0,
    j0: 0,
    z0: 99, // sorts after the base
    draw(g) {
      const { ox, oy, ci, cj, cz, ri, rj, rz } = c;
      const mask = new Grid(g.w, g.h);
      const L = [-0.25, 0.45, 0.85];
      const ln = Math.hypot(...L);
      for (let py = 0; py < g.h; py++)
        for (let px = 0; px < g.w; px++) {
          const a = (px + 0.5 - ox) / 16;
          const Y = py + 0.5 - oy;
          const f = (t) =>
            ((t / 2 + a / 2 - ci) / ri) ** 2 +
            ((t / 2 - a / 2 - cj) / rj) ** 2 +
            ((8 * t - Y - cz) / rz) ** 2 -
            1;
          const f0 = f(0);
          const A = (f(1) + f(-1)) / 2 - f0;
          const B = (f(1) - f(-1)) / 2;
          const disc = B * B - 4 * A * f0;
          if (disc < 0) continue;
          const t = (-B + Math.sqrt(disc)) / (2 * A);
          const i = t / 2 + a / 2;
          const j = t / 2 - a / 2;
          const z = 8 * t - Y;
          if (z < cz) continue;
          const s = 11;
          const n = [(i - ci) / (ri * ri) / s, (j - cj) / (rj * rj) / s, (z - cz) / (rz * rz)];
          const nl = Math.hypot(...n);
          const lit = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nl * ln);
          const lvl = lit > 0.62 ? 2 : lit > 0.28 ? 1 : 0;
          // brick courses by height along the surface, staggered columns by azimuth
          const th = Math.acos(Math.min(1, (z - cz) / rz));
          const v = th * rz * 1.1;
          const row = Math.floor(v / 3.4);
          const phi = Math.atan2((j - cj) / rj, (i - ci) / ri);
          const col = Math.floor((phi * 9 + (row % 2) * 0.5 * 2.2) / 2.2);
          const mortarRow = v % 3.4 < 1;
          const mortarCol = Math.abs(((phi * 9 + (row % 2) * 1.1) / 2.2) % 1) < 0.14;
          const base = ['e', 'f', 'g'][lvl];
          const mortar = ['a', 'e', 'f'][lvl];
          let ch = mortarRow || mortarCol ? mortar : base;
          if (!mortarRow && !mortarCol && hash(col, row, 3) < 160)
            ch = ['a', 'f', 'g'][lvl] === ch ? ch : ['e', 'g', 'n'][lvl];
          mask.set(px, py, ch);
        }
      for (let py = 0; py < g.h; py++)
        for (let px = 0; px < g.w; px++) {
          const c2 = mask.get(px, py);
          if (c2 === '.') continue;
          const edge =
            mask.get(px - 1, py) === '.' ||
            mask.get(px + 1, py) === '.' ||
            mask.get(px, py - 1) === '.' ||
            mask.get(px, py + 1) === '.';
          g.set(px, py, edge ? 'k' : c2);
        }
    },
  };
}

function oven(glow, back) {
  const [ox, oy] = OR.oven;
  return boxes(2, 1, ox, oy, [
    part({
      i0: 0,
      j0: 0,
      i1: 2,
      j1: 1,
      z0: 0,
      z1: 11,
      top: 'g',
      left: 'f',
      right: 'e',
      decal: (face, a, e) => {
        if (face === 'top') return 'f';
        if (face === 'left' && !back) {
          // Arched mouth in the face the chef stands in front of.
          const dx = (a - 16) / 8;
          if (
            e >= 1 &&
            dx * dx + (e > 4.5 ? ((e - 4.5) / 6) ** 2 : 0) <= 1 &&
            Math.abs(a - 16) < 8
          ) {
            const inner =
              Math.abs(a - 16) < 6 &&
              e < 10 &&
              e >= 2 &&
              (e < 5.5 || ((e - 5.5) / 4) ** 2 + ((a - 16) / 6.2) ** 2 <= 1);
            if (!inner) return 'j'; // pale arch stones
            if (glow === 'off') return e < 3 ? 'e' : 'k';
            const fl = glow === 1 ? 1 : 0;
            if (e < 3.5 + fl) return 'v';
            if (e < 5 + fl) return 'u';
            return (a + e) % 3 === 0 ? 'n' : 'm';
          }
        }
        if (face !== 'top') {
          const row = Math.floor(e / 3.4);
          const off = row % 2 === 0 ? 0 : 4;
          if (e % 3.4 < 1) return face === 'left' ? 'e' : 'a';
          if ((Math.floor(a) + off) % 8 === 0) return face === 'left' ? 'e' : 'a';
        }
        return undefined;
      },
    }),
    dome({ ox, oy, ci: 1, cj: 0.5, cz: 11, ri: 0.97, rj: 0.46, rz: 15 }),
    // Chimney pipe on the back half of the dome.
    part({
      i0: 1.15,
      j0: 0.12,
      i1: 1.5,
      j1: 0.4,
      z0: 22,
      z1: 33,
      top: 'K',
      left: 'w',
      right: 'k',
      decal: (f, a, e) => (f === 'top' ? 'k' : e > 8 ? 'x' : undefined),
    }),
    part({
      i0: 1.08,
      j0: 0.06,
      i1: 1.57,
      j1: 0.46,
      z0: 31,
      z1: 34,
      top: 'K',
      left: 'x',
      right: 'w',
    }),
  ]);
}

function ovenCopper() {
  const [ox, oy] = OR.oven;
  const full = boxes(2, 1, ox, oy, [
    part({
      i0: 1.04,
      j0: 0.02,
      i1: 1.61,
      j1: 0.5,
      z0: 25,
      z1: 29,
      top: 'v',
      left: 'Z',
      right: 'Q',
    }),
    part({
      i0: 1.1,
      j0: 0.08,
      i1: 1.55,
      j1: 0.44,
      z0: 29,
      z1: 30,
      top: 'v',
      left: 'Z',
      right: 'Q',
    }),
  ]);
  return full;
}

function woodpile() {
  return [
    '..........',
    '..........',
    '..kkkkkk..',
    '.kdcbbbbk.',
    '.kdcbbbbk.',
    'kkkkkkkkkk',
    'kdcbbkdcbk',
    'kdcbbkdcbk',
    'kkkkkkkkkk',
  ];
}

export function generateWorld() {
  const t = (name, w, h, kind, rows, dir) =>
    spriteText(`sprite ${name} ${w}x${h} pivot 0,0 kind ${kind}`, still(rows, dir));
  const floors = [
    t('floor_wood_0', 32, 16, 'floor', woodFloor(0)),
    t('floor_wood_1', 32, 16, 'floor', woodFloor(1)),
    t('floor_tile', 32, 16, 'floor', checkerFloor()),
    t('floor_terracotta', 32, 16, 'floor', terracottaFloor()),
    t('floor_herringbone', 32, 16, 'floor', herringboneFloor()),
    t('door_mat', 32, 16, 'floor', doorMat()),
  ];
  writePx('world/floors.px', floors.join('\n'));
  const walls = [];
  for (const style of ['cream', 'brick', 'green_stripes', 'blue_tiles'])
    for (const side of ['l', 'r'])
      for (const end of [false, true]) {
        const name = `wall_back_${side}${end ? '_end' : ''}${style === 'cream' ? '' : `_${style}`}`;
        walls.push(t(name, 16, 48, 'wall', backWall(side, end, style)));
      }
  writePx('world/walls.px', walls.join('\n'));
  writePx(
    'world/frames.px',
    [
      t('wall_front_l', 16, 12, 'lowwall', lowWall('l')),
      t('wall_front_r', 16, 12, 'lowwall', lowWall('r')),
      t('door_frame', 16, 40, 'prop', doorFrame()),
    ].join('\n'),
  );
  const fur = (name, [ox, oy], w, h, anims, extra) =>
    spriteText(
      `sprite ${name} ${(w + h) * 16}x${oy + (w + h) * 8} pivot ${ox},${oy} kind prop`,
      anims,
      extra,
    );
  const A = (rows, dir) => ({ name: 'still', dir, fps: 1, frames: [rows] });
  const out = [
    fur('chair_wood', OR.chair, 1, 1, [
      A(chair(false).rows(), 'front'),
      A(chair(true).rows(), 'back'),
    ]),
    fur('table_small', OR.table, 1, 1, [A(table().rows(), 'front'), A(table().rows(), 'back')]),
    fur('counter_pass', OR.pass, 2, 1, [
      A(pass(false).rows(), 'front'),
      A(pass(true).rows(), 'back'),
    ]),
    fur('oven_pizza', OR.oven, 2, 1, [
      A(oven('off', false).rows(), 'front'),
      {
        name: 'bake',
        dir: 'front',
        fps: 4.5,
        frames: [oven(0, false).rows(), oven(1, false).rows()],
      },
      A(oven('off', true).rows(), 'back'),
    ]),
    fur('oven_copper', OR.oven, 2, 1, [A(ovenCopper().rows(), 'front')]),
    spriteText('sprite oven_woodpile 10x9 pivot 5,8 kind prop', still(woodpile())),
  ];
  writePx('world/furniture.px', out.join('\n'));
}
if (process.argv[1] === new URL(import.meta.url).pathname) generateWorld();
export { boxes, part, legs, hash };
