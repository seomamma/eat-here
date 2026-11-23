// Draft generator for assets/sprites/characters/*.px (chunky style D-027, concept board "Style C").
// Layers small text patches (reference colours, recoloured per character) + a 1 px outline.
import { Grid, spriteText, writePx } from './lib.mjs';

// ---- reference patches (guest colours; recoloured per character) --------------------------
const HEAD = {
  short: {
    front: [
      '..aaaaaa..',
      '.abbaaaaa.',
      '.aaaaaaaa.',
      '.aBBBBBBa.',
      '.BBkBBkBB.',
      '.BBBBBBBB.',
      '.BBBBBBBB.',
      '..CCCCCC..',
    ],
    back: [
      '..aaaaaa..',
      '.abbaaaaa.',
      '.aaaaaaaa.',
      '.aaaaaaaa.',
      '.aaaaaaaa.',
      '.aaaaaaaa.',
      '.aaaaaaaa.',
      '..aaaaaa..',
    ],
  },
  // Waiter: young, side-swept fringe with a cowlick, short sides.
  swept: {
    front: [
      '...bbbbb..',
      '.bbccccbb.',
      '.bcccbbbbb',
      '.bbBBBbbB.',
      '.BBkBBkBB.',
      '.BBBBBBBB.',
      '.BBBBBBBB.',
      '..CCCCCC..',
    ],
    back: [
      '...bbbbb..',
      '.bbccccbb.',
      '.bbbbbbbbb',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '.abbbbbba.',
      '.aaaaaaaa.',
      '..aaaaaa..',
    ],
  },
  // Nonna Rosa: grey bun on top, small round glasses.
  nonna: {
    front: [
      '....JJJJ..',
      '...JKJJJK.',
      '..JJJJJJJJ',
      '.KJJJJJJJK',
      '.BzkBBzkB.',
      '.BBBBBBBB.',
      '.BBBBBBBB.',
      '..CCCCCC..',
    ].map((r) => r.slice(0, 10).padEnd(10, '.')),
    back: [
      '....JJJJ..',
      '...JKJJJK.',
      '..JJJJJJJJ',
      '.JJJJJJJJK',
      '.JJJJJJJJK',
      '.JJJJJJJJK',
      '.KJJJJJJKK',
      '..KKKKKK..',
    ],
  },
  // Oliver: red cap with a visor; dark hair at the sides.
  cap: {
    front: [
      '..RRRRRR..',
      '.RSSRRRRR.',
      '.RRRRRRRR.',
      '.TTTTTTTT.',
      '.BBkBBkBB.',
      '.BBBBBBBB.',
      '.BBBBBBBB.',
      '..CCCCCC..',
    ],
    back: [
      '..RRRRRR..',
      '.RSSRRRRR.',
      '.RRRRRRRR.',
      '.RRRRRRRR.',
      '.TTTTTTTTT',
      '.aaaaaaaa.',
      '.aaaaaaaa.',
      '..aaaaaa..',
    ],
  },
  // Mia: bob with a fringe; ponytail is added as an extra patch.
  mia: {
    front: [
      '..bbbbbb..',
      '.bccbbbbb.',
      '.bbbbbbbb.',
      '.bBBBBBBb.',
      '.BBkBBkBB.',
      '.BBBBBBBB.',
      '.BBBBBBBB.',
      '..CCCCCC..',
    ],
    back: [
      '..bbbbbb..',
      '.bccbbbbb.',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '.bbbbbbbb.',
      '..bbbbbb..',
    ],
  },
};
// Chef head incl. the tall hat (12 wide), placed 1 px left of the normal head.
const CHEF_HEAD = {
  front: [
    '...hhhhhh...',
    '..hWWhhhhhi.',
    '.hWWhhhhhhhi',
    '.hWhhhhhhhhi',
    '.hhhhhhhhhii',
    '..iiiiiiiii.',
    '..CCCCCCCC..',
    '..BBBBBBBB..',
    '..BBkBBkBB..',
    '..BBBBBBBB..',
    '...CCCCCC...',
  ],
  back: [
    '...hhhhhh...',
    '..hWWhhhhhi.',
    '.hWWhhhhhhhi',
    '.hWhhhhhhhhi',
    '.hhhhhhhhhii',
    '..iiiiiiiii.',
    '..aaaaaaaa..',
    '..aaaaaaaa..',
    '..aaaaaaaa..',
    '..aaaaaaaa..',
    '...aaaaaa...',
  ],
};

const TORSO = {
  shirt: {
    front: ['nmmBBmml', 'nmmmmmml', 'nmmmmmml', 'nmmmmmml', 'nmmmmmml', 'wwwwwwww'],
    back: ['nmmCCmml', 'nmmmmmml', 'nmmmmmml', 'nmmmmmml', 'nmmmmmml', 'wwwwwwww'],
  },
  chef: {
    front: ['Wmmmmmmi', 'Whmmmmhi', 'Whhmmhhi', 'Whhmhhhi', 'Whhhhhhi', 'wwwwwwww'],
    back: ['WhhCChhi', 'Whhhhhhi', 'Whhhhhhi', 'Whhhhhhi', 'Whhhhhhi', 'wwwwwwww'],
  },
  waiter: {
    front: ['zzlBBlzy', 'zlmmmmly', 'zmnmmmly', 'zmmmmmly', 'zmmmmmly', 'lmmmmmll'],
    back: ['zzlCClzy', 'zzlllzzy', 'zzzzzzzy', 'zzzzzzzy', 'zzlllzzy', 'wwwwwwww'],
  },
  nonna: {
    // dark dress, mustard shawl over the shoulders with a fringe.
    front: ['NMMBBMML', 'NMMMMMML', 'xLMMMMLw', 'xwLMMLww', 'xwwLwwww', 'xwwwwwww'],
    back: ['NMMCCMML', 'NMMMMMML', 'xMMMMMMw', 'xLMMMMLw', 'xwwwwwww', 'xwwwwwww'],
  },
};

/** Per character: recolour maps for the reference letters. */
export const LOOKS = {
  chef: { W: 'W', h: 'h', i: 'i', m: 'm', l: 'l', a: 'a', w: 'w', x: 'x' },
  waiter: { b: 'b', c: 'c', a: 'a', z: 'z', y: 'y', m: 'm', n: 'n', l: 'l', w: 'w', x: 'x' },
};

// ---- composer -----------------------------------------------------------------------------
/**
 * @param spec { W, head, headX, headY, torso, legs: 'pants'|'skirt', sleeve:[hi,base,lo], hand:[hi,lo],
 *               pants:[base,hi], shoes:[base,hi], map, extras?: (g, ctx) => void }
 * @param facing 'front' | 'back'
 * @param pose { dy, legs, armL, armR, sit, ... }
 */
function render(spec, facing, pose = {}) {
  const ox = (spec.W - 16) / 2;
  const g = new Grid(spec.W, 24);
  const map = spec.map ?? {};
  const dy = pose.dy ?? 0;
  const [pBase, pHi] = spec.pants;
  const [sBase, sHi] = spec.shoes;
  const [s1, s2, s3] = spec.sleeve; // hi, base, lo
  const [h1, h2] = spec.hand; // base, lo
  const seat = pose.sit ? 5 : 0;
  const top = dy + seat;

  // Legs / skirt.
  if (pose.sit) {
    g.rect(ox + 4, 22, ox + 11, 22, pBase);
    g.rect(ox + 4, 22, ox + 4, 22, pHi);
    g.put(ox + 3, 22, ['.'], map);
  } else if (spec.legs === 'skirt') {
    const y0 = 17;
    for (let y = y0; y <= 21; y++) {
      const half = 4 + Math.floor((y - y0) / 2);
      g.rect(ox + 8 - half, y, ox + 7 + half, y, pBase);
      g.set(ox + 8 - half, y, pHi);
    }
    const lift = { L: pose.legs === 'liftL' ? 1 : 0, R: pose.legs === 'liftR' ? 1 : 0 };
    const spread = pose.legs === 'spread' ? 1 : 0;
    g.rect(ox + 4 - spread, 22 - lift.L, ox + 6 - spread, 22 - lift.L, sBase);
    g.rect(ox + 9 + spread, 22 - lift.R, ox + 11 + spread, 22 - lift.R, sBase);
  } else {
    const spread = pose.legs === 'spread' ? 1 : 0;
    const lift = { L: pose.legs === 'liftL' ? 1 : 0, R: pose.legs === 'liftR' ? 1 : 0 };
    const leg = (lx, l) => {
      g.rect(lx, 17, lx + 2, 21 - l, pBase);
      g.rect(lx, 17, lx, 20 - l, pHi);
      g.rect(lx, 21 - l, lx + 2, 22 - l, sBase);
      g.set(lx, 21 - l, sHi);
    };
    leg(ox + 4 - spread, lift.L);
    leg(ox + 9 + spread, lift.R);
  }

  // Torso (6 rows at y = 11 + top).
  const torso = spec.torso[facing];
  g.put(ox + 4, 11 + top, torso, map);

  // Waiter apron skirt over the legs.
  if (spec.apronSkirt && !pose.sit) {
    for (let y = 17; y <= 19; y++) {
      const w = y === 19 ? 'l' : 'm';
      g.rect(ox + 4, y + top - dy + dy, ox + 11, y, w);
      g.set(ox + 4, y, y === 19 ? 'l' : 'n');
      g.set(ox + 11, y, 'l');
    }
  }

  // Arms.
  const arm = (side, mode) => {
    const x = side === 'L' ? ox + 2 : ox + 12;
    const hi = side === 'L' ? s1 : s2;
    const lo = side === 'L' ? s2 : s3;
    let y0 = 11 + top;
    if (mode === 'up1') y0 -= 1;
    if (mode === 'dn1') y0 += 1;
    if (mode === 'raise') {
      // Arm up beside the head, hand open at the top.
      const yy = 5 + top - dy + dy;
      const xx = (side === 'L' ? ox + 2 : ox + 13) + (pose.wave ?? 0);
      g.rect(xx, yy + 2, xx + 1, yy + 7, hi);
      g.rect(xx, yy, xx + 1, yy + 1, h1);
      g.set(xx + 1, yy + 1, h2);
      return;
    }
    if (mode === 'eatUp') {
      const xx = side === 'L' ? x : x - 1;
      g.rect(xx + 1, 13 + top, xx + 2, 16 + top, hi);
      g.rect(xx, 10 + top, xx + 1, 12 + top, h1);
      g.set(xx - 1, 10 + top, 'u');
      g.set(xx - 1, 11 + top, 't');
      return;
    }
    if (mode === 'fwd') {
      // Forearm bent forward: hand moves inward and up.
      g.rect(x, y0, x + 1, y0 + 2, hi);
      g.set(x + 1, y0, lo);
      const hx = side === 'L' ? x + 1 : x - 1;
      g.rect(hx, y0 + 3, hx + 1, y0 + 4, h1);
      g.set(hx + (side === 'L' ? 0 : 1), y0 + 4, h2);
      return;
    }
    g.rect(x, y0, x + 1, y0 + 2, hi);
    g.rect(side === 'L' ? x + 1 : x, y0, side === 'L' ? x + 1 : x, y0 + 2, lo);
    g.rect(x, y0 + 3, x + 1, y0 + 4, h1);
    g.set(side === 'L' ? x : x + 1, y0 + 4, h2);
  };
  if (pose.armL !== 'none' && !(pose.sit && pose.armR === 'raise')) arm('L', pose.armL ?? 'down');
  if (pose.peel) {
    // Chef at the oven (back view): right arm out, a long peel (with a pizza on its blade) or a log
    // pointing up-right along the 2:1 line.
    const hx = ox + 13;
    const hy = 11 + top;
    g.rect(ox + 12, hy, ox + 13, hy + 2, s2);
    g.rect(hx, hy - 1, hx + 1, hy, h1);
    const r = pose.peel.r;
    if (pose.peel.tool === 'peel') peel(g, hx + 2, hy - 1, r, pose.peel.pizza);
    if (pose.peel.log) g.put(hx + 1 + r * 2, hy - 2 - r, ['dbb', 'dab']);
  } else arm('R', pose.armR ?? 'down');
  if (pose.pad) {
    g.put(ox + 5, 13 + top, ['hhhh', 'hjjh', 'hhhh', 'hjjh']);
    g.set(ox + 9 + (pose.pad === 2 ? 1 : 0), 14 + top, 'u');
    g.set(ox + 9 + (pose.pad === 2 ? 1 : 0), 15 + top, 'k');
  }
  if (pose.sit) {
    // Forearms rest on the table: drawn over the torso front.
    if (!pose.armsUp) {
      g.rect(ox + 3, 19 + 0, ox + 4, 20, h1);
      g.rect(ox + 11, 19, ox + 12, 20, h1);
    }
  }

  // Head (and hat / bun).
  const hd = spec.head[facing];
  g.put(ox + spec.headX, spec.headY + top, hd, map);
  if (spec.headExtra) spec.headExtra(g, { ox, top, facing, pose });

  if (spec.extras) spec.extras(g, { ox, top, dy, facing, pose, map });
  g.outline('k');
  return g.rows();
}

// ---- 2:1 line helpers for the peel and the log ---------------------------------------------
function line21(g, x, y, steps, ch) {
  // From (x, y) up-right: 2 px across, 1 px up per step.
  for (let i = 0; i < steps; i++) {
    g.set(x + i * 2, y - i, ch);
    g.set(x + i * 2 + 1, y - i, ch);
  }
}
/** Peel: a 2 px handle for r steps, then a 3-step blade (4 px thick), pizza on the blade. */
function peel(g, x, y, r, withPizza) {
  for (let i = 0; i < r; i++) {
    g.rect(x + i * 2, y - i, x + i * 2 + 1, y - i, 'd');
    g.rect(x + i * 2, y - i + 1, x + i * 2 + 1, y - i + 1, 'c');
  }
  for (let i = r; i < r + 3; i++) {
    const cx = x + i * 2;
    const cy = y - i;
    g.rect(cx, cy - 1, cx + 1, cy - 1, 'd');
    g.rect(cx, cy, cx + 1, cy + 1, 'c');
    g.rect(cx, cy + 2, cx + 1, cy + 2, 'b');
  }
  if (withPizza) {
    const mx = x + (r + 1) * 2;
    const my = y - (r + 1);
    g.put(mx - 3, my - 4, ['.tttttt.', 'tuuvuuut', 'tumuvmut', '.tttttt.']);
  }
}
function pizza(g, x, y) {
  // 6x3 pizza seen from the side-top: crust ring, cheese, tomato spots.
  g.put(x, y, ['.ttttt.', 'tuuvuut', '.ttmtt.'.replace('m', 'u')]);
  g.set(x + 2, y + 1, 'm');
  g.set(x + 4, y + 1, 'm');
  g.set(x + 3, y + 2, 'm');
}

// ---- character specs ------------------------------------------------------------------------
const baseGuest = {
  W: 16,
  head: HEAD.short,
  headX: 3,
  headY: 3,
  torso: TORSO.shirt,
  legs: 'pants',
  sleeve: ['n', 'm', 'l'],
  hand: ['B', 'C'],
  pants: ['w', 'x'],
  shoes: ['a', 'b'],
};

const SPECS = {
  guest: baseGuest,
  waiter: {
    ...baseGuest,
    head: HEAD.swept,
    torso: TORSO.waiter,
    apronSkirt: true,
    sleeve: ['z', 'z', 'y'],
    pants: ['w', 'x'],
  },
  nonna: {
    ...baseGuest,
    head: HEAD.nonna,
    torso: TORSO.nonna,
    legs: 'skirt',
    sleeve: ['N', 'M', 'L'],
    pants: ['w', 'x'],
    shoes: ['a', 'b'],
    headExtra: (g, { ox, top }) => {
      // Big grey bun on top and a plum shawl that hangs wider than the shoulders, with fringe.
      g.put(ox + 6, top, ['.JJJJ.', 'JJJJK.', 'JJJKK.']);
      for (let y = 11; y <= 15; y++) {
        g.set(ox + 3, y + top, 'N');
        g.set(ox + 12, y + top, 'L');
      }
      for (const x of [3, 5, 7, 9, 12]) g.set(ox + x, 16 + top, x < 8 ? 'N' : 'L');
    },
  },
  oliver: {
    ...baseGuest,
    head: HEAD.cap,
    sleeve: ['r', 'q', 'p'],
    map: { m: 'q', n: 'r', l: 'p', R: 'm', S: 'n', T: 'l' },
    pants: ['x', 'y'],
    shoes: ['a', 'b'],
  },
  mia: {
    ...baseGuest,
    head: HEAD.mia,
    sleeve: ['Y', 'Y', 'X'],
    map: { m: 'Y', n: 'U', l: 'X', b: 'Q', c: 'Z', a: 'Q' },
    pants: ['x', 'y'],
    headExtra: (g, { ox, top, facing }) => {
      // Copper ponytail swinging out to the right, tied with a tomato-red bow.
      const x = ox + 13;
      g.rect(x, 7 + top, x + 2, 9 + top, 'Z');
      g.rect(x + 1, 10 + top, x + 2, 12 + top, 'Z');
      g.set(x + 2, 13 + top, 'Q');
      g.set(x + 1, 13 + top, 'Z');
      g.set(x, 7 + top, 'Q');
      g.set(x + 2, 11 + top, 'Q');
      g.set(x, 6 + top, 'm');
      g.set(x + 1, 6 + top, 'n');
      g.set(x + 2, 6 + top, 'm');
      if (facing === 'back') g.set(x + 1, 8 + top, 'W');
    },
  },
  chef: {
    ...baseGuest,
    W: 40,
    head: CHEF_HEAD,
    headX: 2,
    headY: 1,
    torso: TORSO.chef,
    sleeve: ['W', 'h', 'i'],
    pants: ['w', 'x'],
  },
};

// Variants (guest bodies) are palette swaps declared in the .px, not drawn.

// ---- animation sets -----------------------------------------------------------------------
const WALK = [
  { dy: 1, legs: 'spread', armL: 'up1', armR: 'dn1' },
  { dy: 0, legs: 'liftR', armL: 'down', armR: 'down' },
  { dy: 1, legs: 'spread', armL: 'dn1', armR: 'up1' },
  { dy: 0, legs: 'liftL', armL: 'down', armR: 'down' },
];
const IDLE = [{}, { dy: 1 }];
const CARRY = WALK.map((p) => ({ ...p, armL: 'fwd', armR: 'fwd' }));

function anims(spec, defs) {
  const out = [];
  for (const [name, fps, poses, opt] of defs) {
    for (const facing of ['front', 'back']) {
      if (opt?.only && opt.only !== facing) continue;
      out.push({
        name,
        dir: facing,
        fps,
        loop: opt?.loop,
        frames: poses.map((p, i) => render(spec, facing, typeof p === 'function' ? p(i) : p)),
      });
    }
  }
  return out;
}

function guestSet(spec) {
  return anims(spec, [
    ['idle', 2, IDLE],
    ['walk', 8, WALK],
    ['sit', 2, [{ sit: true }, { sit: true, dy: 0 }].slice(0, 1)],
    ['eat', 2, [{ sit: true }, { sit: true, armR: 'eatUp' }]],
    [
      'hand',
      3,
      [
        { sit: true, armR: 'raise', armsUp: true },
        { sit: true, armR: 'raise', armsUp: true, wave: 1 },
      ],
    ],
  ]);
}

const header = (name, w) => `sprite ${name} ${w}x24 pivot ${w / 2},23 kind character`;

export function generateCharacters() {
  const g = SPECS.guest;
  const text = spriteText(
    header('guest', 16),
    guestSet(g),
    [
      '# Palette-swapped guests: skin, hair and shirt change; shapes are shared.',
      'variant guest1 B=E C=F A=D a=k b=a m=x n=y l=w',
      'variant guest2 B=C C=I a=u b=v m=r n=s l=q',
      'variant guest3 B=A C=B a=l b=m m=u n=v l=t',
    ].join('\n'),
  );
  writePx('characters/guest.px', text);
  writePx(
    'characters/waiter.px',
    spriteText(
      header('waiter', 16),
      anims(SPECS.waiter, [
        ['idle', 2, IDLE],
        ['walk', 8, WALK],
        ['carry', 8, CARRY],
        [
          'order',
          3,
          [
            { armL: 'fwd', armR: 'fwd', pad: 1 },
            { armL: 'fwd', armR: 'fwd', pad: 2 },
          ],
        ],
      ]),
    ),
  );
  for (const id of ['nonna', 'oliver', 'mia']) {
    const name = id === 'nonna' ? 'nonna_rosa' : id;
    writePx(`characters/${name}.px`, spriteText(header(name, 16), guestSet(SPECS[id])));
  }
  writePx(
    'characters/chef.px',
    spriteText(
      header('chef', 40),
      anims(SPECS.chef, [
        ['idle', 2, IDLE],
        ['walk', 8, WALK],
        ['carry', 8, CARRY],
        [
          'bake',
          6,
          [
            { peel: { r: 0, tool: 'peel', pizza: true } },
            { peel: { r: 1, tool: 'peel', pizza: true } },
            { peel: { r: 3, tool: 'peel', pizza: true } },
            { peel: { r: 3, tool: 'peel' } },
            { peel: { r: 1, tool: 'peel' } },
          ],
          { only: 'back', loop: false },
        ],
        [
          'take',
          6,
          [
            { peel: { r: 1, tool: 'peel' } },
            { peel: { r: 3, tool: 'peel' } },
            { peel: { r: 2, tool: 'peel', pizza: true } },
            { peel: { r: 1, tool: 'peel', pizza: true } },
            { peel: { r: 0, tool: 'peel', pizza: true } },
          ],
          { only: 'back', loop: false },
        ],
        [
          'stoke',
          4,
          [
            { peel: { r: 0, log: true } },
            { peel: { r: 1, log: true } },
            { peel: { r: 2, log: true } },
            { peel: { r: 2 } },
          ],
          { only: 'back' },
        ],
      ]),
    ),
  );
}

if (process.argv[1] === new URL(import.meta.url).pathname) generateCharacters();
export { render, SPECS, line21, pizza };
