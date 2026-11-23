// Pizza oven (M13b redraw): a round brick dome with an arched mouth and a steel chimney on the
// first tile and a stone prep ledge with a board and a dough ball on the second tile.
// Frames: still (cold mouth), bake x2 (flicker), flare x2 (the pizza goes in), back view.
import { Grid, blobs, boxes, hash, part, plot, proj } from './iso.mjs';

export const OVEN_ORIGIN = [16, 34];
const [OX, OY] = OVEN_ORIGIN;

const BRICK = ['e', 'f', 'g', 'g'];
const MORTAR = ['a', 'e', 'f', 'f'];

/** Brick courses that follow the curve: rows by polar angle, staggered joints by azimuth. */
function brick(info) {
  const v = info.th * 19;
  const row = Math.floor(v / 3.3);
  const n = Math.max(5, Math.round(15 * Math.sin(Math.max(info.th, 0.15))));
  const u = (info.phi + Math.PI) / (2 * Math.PI) * n + (row % 2) * 0.5;
  const col = Math.floor(u);
  const lvl = info.lvl;
  if (v % 3.3 < 0.85) return MORTAR[lvl];
  if (u - col < 0.13 + (info.th < 0.35 ? 0.1 : 0)) return MORTAR[lvl];
  if (hash(col, row, 11) < 120) return BRICK[Math.min(3, lvl + 1)];
  return BRICK[lvl];
}

/** Mouth (arched opening) drawn straight onto the grid. glow: 'off' | 0 | 1 | 'flare0' | 'flare1'. */
function mouth(g, xc, yb, glow) {
  const half = 4;
  const top = (c) => 4 + Math.round(4 * Math.sqrt(Math.max(0, 1 - (c / (half + 0.4)) ** 2)));
  // Pale stones around the opening.
  for (let c = -half - 1; c <= half + 1; c++) {
    const h = top(Math.max(-half, Math.min(half, c)));
    const yBase = yb + Math.floor(c / 2);
    const edge = Math.abs(c) > half;
    for (let k = 0; k <= h + 1; k++) {
      const y = yBase - k;
      const inside = !edge && k < h;
      if (inside) continue;
      g.set(xc + c, y, k > h ? 'k' : (c + k) % 3 === 0 ? 'i' : 'j');
    }
  }
  for (let c = -half; c <= half; c++) {
    const h = top(c);
    const yBase = yb + Math.floor(c / 2);
    for (let k = 0; k < h; k++) {
      const y = yBase - k;
      let ch;
      if (glow === 'off') ch = k === 0 && (c === -2 || c === 1) ? 'e' : 'k';
      else {
        const f = typeof glow === 'string' ? 1 : 0;
        const flick = glow === 1 || glow === 'flare1' ? 1 : 0;
        if (k < 1 + f) ch = flick ? 'W' : 'v';
        else if (k < 3 + f) ch = (c + k + flick) % 3 === 0 ? 'v' : 'u';
        else if (k < 5 + f) ch = (c + flick) % 2 === 0 ? 'n' : 'm';
        else ch = k < h - 1 ? 'm' : 'l';
        if (typeof glow === 'string' && k < 2 && c % 2 === 0) ch = 'W';
      }
      g.set(xc + c, y, ch);
    }
  }
}

/** Sparks flying out of the mouth on a flare. */
function sparks(g, xc, yb, glow) {
  if (typeof glow !== 'string') return;
  const f = glow === 'flare1' ? 1 : 0;
  g.set(xc - 2 + f, yb - 12 - f * 2, 'v');
  g.set(xc + 3 - f, yb - 11 - f, 'u');
  g.set(xc + 1, yb - 13 + f * 3, 'W');
}

export function ovenDraw(view, glow = 'off') {
  const back = view === 'back';
  const ci = back ? 1.5 : 0.5;
  const ledgeI0 = back ? 0.04 : 1.0;
  const ledgeI1 = back ? 1.0 : 1.96;
  const parts = [
    part({
      i0: 0, j0: 0.04, i1: 2, j1: 0.96, z0: 0, z1: 8,
      top: 'g', left: 'f', right: 'e',
      decal: (face, a, e) => {
        if (face === 'top') return 'f';
        const row = Math.floor(e / 2);
        if (e % 2 < 1) return face === 'left' ? 'e' : 'a';
        if ((Math.floor(a) + (row % 2) * 4) % 8 === 0) return face === 'left' ? 'e' : 'a';
        return undefined;
      },
    }),
    // Prep ledge: cream stone with a wooden board and a dough ball.
    part({
      i0: ledgeI0, j0: 0.04, i1: ledgeI1, j1: 0.96, z0: 8, z1: 10.5,
      top: 'h', left: 'i', right: 'j',
      decal: (face, a, e) => (face !== 'top' && e < 1 ? 'j' : undefined),
    }),
    part({
      i0: ledgeI0 + 0.2, j0: 0.28, i1: ledgeI1 - 0.2, j1: 0.72, z0: 10.5, z1: 12,
      top: 'd', left: 'c', right: 'b',
    }),
    blobs({
      ox: OX, oy: OY, sort: [ci === 0.5 ? 1.2 : 0.2, 0.4, 12], levels: [0.1, 0.35, 0.6],
      clusters: [
        { ci: (ledgeI0 + ledgeI1) / 2 - 0.1, cj: 0.5, cz: 12, ri: 0.14, rj: 0.14, rz: 3.2, zmin: 12, ramp: ['j', 'i', 'h', 'W'] },
      ],
    }),
    blobs({
      ox: OX, oy: OY, sort: [0.1, 0.1, 8], levels: [0.12, 0.36, 0.6],
      clusters: [{ ci, cj: 0.5, cz: 8, ri: 0.56, rj: 0.5, rz: 19, zmin: 8, ramp: BRICK, tex: brick }],
    }),
    // Chimney: steel pipe with a cap, on the far side of the dome from the mouth.
    part({
      i0: ci + 0.02, j0: back ? 0.6 : 0.18, i1: ci + 0.22, j1: back ? 0.8 : 0.38, z0: 21, z1: 38,
      top: 'K', left: 'x', right: 'w',
      decal: (face, a, e) => (face === 'top' ? 'k' : e > 14 ? 'x' : undefined),
    }),
    part({
      i0: ci - 0.04, j0: back ? 0.56 : 0.14, i1: ci + 0.26, j1: back ? 0.86 : 0.44, z0: 36, z1: 39,
      top: 'K', left: 'x', right: 'w',
    }),
  ];
  if (!back)
    parts.push(
      plot((g) => {
        const xc = OX + Math.round((0.6 - 0.98) * 16);
        const yb = OY + Math.round((0.6 + 0.98) * 8 - 8);
        mouth(g, xc, yb, glow);
        sparks(g, xc, yb, glow);
      }, [1.5, 0.5, 20]),
    );
  return boxes(2, 1, OX, OY, parts);
}

/** Copper collar around the chimney (Lv.5), same canvas as the oven. */
export function ovenCopperDraw() {
  const ci = 0.5;
  return boxes(2, 1, OX, OY, [
    part({ i0: ci - 0.01, j0: 0.16, i1: ci + 0.25, j1: 0.4, z0: 28, z1: 32, top: 'v', left: 'Z', right: 'Q' }),
    part({ i0: ci + 0.03, j0: 0.21, i1: ci + 0.19, j1: 0.37, z0: 32, z1: 33, top: 'v', left: 'Z', right: 'Q' }),
  ]);
}

export function ovenText(spriteText) {
  const W = 48;
  const H = OY + 24;
  const rows = (g) => g.rows();
  const anim = (name, dir, frames, fps = 1) => ({ name, dir, fps, frames: frames.map(rows) });
  const header = (n) => `sprite ${n} ${W}x${H} pivot ${OX},${OY} kind prop`;
  return [
    spriteText(header('oven_pizza'), [
      anim('still', 'front', [ovenDraw('front', 'off')]),
      anim('bake', 'front', [ovenDraw('front', 0), ovenDraw('front', 1)], 4.5),
      anim('flare', 'front', [ovenDraw('front', 'flare0'), ovenDraw('front', 'flare1')], 9),
      anim('still', 'back', [ovenDraw('back', 'off')]),
    ]),
    spriteText(header('oven_copper'), [anim('still', 'front', [ovenCopperDraw()])]),
  ].join('\n');
}

void Grid;
void proj;
