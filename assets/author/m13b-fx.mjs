// Small FX art (M13b): selection marker, tile highlight, sparkle (4 frames), door leaf (closed /
// ajar), floor-lamp night glow. The door leaf is fitted to the opening of world/frames.px door_frame.
import { readFileSync } from 'node:fs';
import { Grid, spriteText } from './lib.mjs';
import { SPRITES } from './lib.mjs';
import { glow } from './m13b-outdoor.mjs';

const still = (rows) => [{ name: 'still', dir: 'none', fps: 1, frames: [rows] }];

const MARKER = [
  'kkkkkkkkkkk',
  'knnnmmmmmmk',
  '.knnmmmmmk.',
  '..knmmmmk..',
  '...kmmmk...',
  '....kmk....',
  '.....k.....',
];

function tileHighlight() {
  const g = new Grid(32, 16);
  const inside = (px, py) => {
    const X = px + 0.5 - 16;
    const Y = py + 0.5;
    return Math.abs(X) / 16 + Math.abs(Y - 8) / 8 <= 1;
  };
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 32; px++) {
      if (!inside(px, py)) continue;
      const edge = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
      if (edge) g.set(px, py, (px + py) % 4 < 2 ? 'v' : 'u');
    }
  return g.rows();
}

const SPARKLE = [
  ['.......', '.......', '...v...', '..vWv..', '...v...', '.......', '.......'],
  ['.......', '...u...', '...v...', '.uvWvu.', '...v...', '...u...', '.......'],
  ['...u...', '.u.v.u.', '..uvu..', 'uvvWvvu', '..uvu..', '.u.v.u.', '...u...'],
  ['.......', '.u...u.', '..v.v..', '...W...', '..v.v..', '.u...u.', '.......'],
];

function doorLeaves() {
  const text = readFileSync(`${SPRITES}world/frames.px`, 'utf8').split('\n');
  const at = text.findIndex((l) => l.startsWith('sprite door_frame'));
  const first = text.findIndex((l, i) => i > at && l === 'frame');
  const frame = text.slice(first + 1, first + 41);
  const base = (x) => 32 + Math.floor(x / 2);
  const startOf = (x) => {
    let seen = false;
    for (let y = 0; y < 40; y++) {
      const c = frame[y][x];
      if (c !== '.') seen = true;
      else if (seen) return y;
    }
    return 12;
  };
  const closed = new Grid(16, 40);
  for (let x = 4; x <= 11; x++) {
    const y0 = startOf(x);
    const y1 = base(x) - 1;
    for (let y = y0; y <= y1; y++) {
      let c = Math.floor(x / 2) % 2 === 0 ? 'c' : 'b';
      if (y === y0) c = 'd';
      if (y === y1) c = 'a';
      if (x === 4) c = c === 'a' ? 'a' : 'd';
      if (x === 11) c = 'a';
      // panel insets
      const h = y - y0;
      if ((h === 11 || h === 12) && x > 4 && x < 11) c = 'a';
      // small window
      if (x >= 6 && x <= 9 && h >= 3 && h <= 8 - Math.floor((x - 6) / 2) * 0) c = h === 3 || x === 6 ? 'x' : h < 6 ? 'z' : 'y';
      closed.set(x, y, c);
    }
    // brass handle
  }
  closed.set(10, startOf(10) + 14, 'u');
  closed.set(10, startOf(10) + 15, 't');
  // Ajar: a slim leaf swung into the room along the hinge post (drawn narrow and darker).
  const open = new Grid(16, 40);
  for (let x = 4; x <= 7; x++) {
    const rise = Math.floor((x - 4) / 2);
    const y0 = startOf(4) + 1 - rise;
    const y1 = base(4) - 1 - rise;
    for (let y = y0; y <= y1; y++) {
      let c = x === 4 ? 'k' : x === 7 ? 'a' : 'b';
      if (y === y0) c = 'c';
      if (y === y1) c = 'k';
      open.set(x, y, c);
    }
  }
  open.set(6, startOf(4) + 14, 'u');
  return { closed: closed.rows(), open: open.rows() };
}

export function fxText() {
  const hdr = (n, w, h, px, py, kind) => `sprite ${n} ${w}x${h} pivot ${px},${py} kind ${kind}`;
  const leaves = doorLeaves();
  const lampGlow = glow(40, 64, 20, 22, 15, 20, 56, { rx: 13, ry: 6 });
  return [
    spriteText(hdr('select_marker', 11, 7, 5, 6, 'ui'), still(MARKER)),
    spriteText(hdr('tile_highlight', 32, 16, 0, 0, 'floor'), still(tileHighlight())),
    spriteText(hdr('sparkle', 7, 7, 3, 3, 'ui'), [{ name: 'twinkle', dir: 'none', fps: 10, frames: SPARKLE }]),
    spriteText(hdr('door_closed', 16, 40, 0, 0, 'prop'), still(leaves.closed)),
    spriteText(hdr('door_open', 16, 40, 0, 0, 'prop'), still(leaves.open)),
    spriteText(hdr('glow_floor_lamp', 40, 64, 20, 48, 'prop'), still(lampGlow)),
  ].join('\n');
}
