// Draft generator for emotes, dishes, coin and the shadow (assets/sprites/ui/*.px).
import { Grid, spriteText, writePx } from './lib.mjs';

const still = (rows) => [{ name: 'still', dir: 'none', fps: 1, frames: [rows] }];

function bubble(fill) {
  const g = new Grid(16, 16);
  g.rect(1, 1, 14, 11, fill);
  for (const [x, y] of [
    [1, 1],
    [14, 1],
    [1, 11],
    [14, 11],
  ])
    g.set(x, y, '.');
  g.rect(7, 12, 8, 13, fill);
  g.set(7, 14, fill);
  g.outline('k');
  return g;
}
function glyph(g, x, y, rows, map = {}) {
  g.put(x, y, rows, map);
}
const EMOTES = {
  hand: {
    fill: 'v',
    rows: ['.k.k.k..', 'kBkBkBk.', 'kBBBBBBk', 'kBBBBBBk', '.kBBBBk.', '..kBBk..', '...kk...'],
    at: [4, 2],
  },
  tasty: {
    fill: 'v',
    rows: ['..kkkk..', '.kuuuuk.', 'kukuukuk', 'kuuuuuuk', 'kukuukuk', '.kukkuk.', '..kkkk..'],
    at: [4, 2],
  },
  love: {
    fill: 'h',
    rows: ['.kk.kk.', 'kmmkmmk', 'kmnmmmk', '.kmmmk.', '..kmk..', '...k...'],
    at: [4, 3],
  },
  heart: {
    fill: 'm',
    rows: ['.kk.kk.', 'khhkhhk', 'khhhhhk', '.khhhk.', '..khk..', '...k...'],
    at: [4, 3],
  },
  slow: {
    fill: 'y',
    rows: ['wwwww...', '...w....', '..w..www', 'wwwww.w.', '.....w..', '.....www'],
    at: [4, 3],
  },
  angry: {
    fill: 'm',
    rows: ['hh..hh', 'h....h', '..hh..', '..hh..', 'h....h', 'hh..hh'],
    at: [5, 3],
  },
};

function dish(id) {
  const g = new Grid(12, 12);
  if (id === 'garlic_bread') {
    for (const y0 of [1, 6]) {
      g.put(
        1,
        y0,
        [
          '.dddddddd..',
          'dccccccccd.',
          'duuuvuuuud.'.slice(0, 11),
          'dcccccccd..'.slice(0, 11),
          '.dddddddd..',
        ].map((r) => r.padEnd(11, '.')),
      );
      g.set(3, y0 + 1, 'r');
      g.set(7, y0 + 1, 'r');
      g.set(5, y0 + 2, 'r');
    }
  } else {
    const base = id === 'marinara' ? 'm' : 'u';
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d > 4.9) continue;
        let c = d > 3.8 ? 'c' : base;
        if (d > 3.8 && x + y < 8) c = 'd';
        if (d <= 3.8 && d > 3.0 && base === 'u') c = 'v';
        g.set(x, y, c);
      }
    const spots = {
      marinara: [
        'r',
        [
          [4, 4],
          [7, 6],
          [5, 7],
          [7, 3],
        ],
      ],
      margherita: [
        'm',
        [
          [4, 3],
          [7, 4],
          [4, 7],
          [7, 7],
        ],
      ],
      pepperoni: [
        'f',
        [
          [4, 3],
          [7, 4],
          [4, 7],
          [7, 7],
          [6, 5],
        ],
      ],
    }[id];
    for (const [x, y] of spots[1]) {
      g.set(x, y, spots[0]);
      g.set(x + 1, y, spots[0]);
      if (id === 'pepperoni') g.set(x, y + 1, spots[0]);
    }
    if (id === 'margherita') {
      g.set(5, 5, 'r');
      g.set(6, 5, 'q');
      g.set(6, 6, 'r');
    }
    if (id === 'marinara') g.set(3, 6, 'v');
  }
  g.outline('k');
  // The outline can reach row/col -1 only; the circle is drawn inside so it fits.
  return g;
}

export function generateUi() {
  const emoteAnims = [];
  for (const [name, e] of Object.entries(EMOTES)) {
    const g = bubble(e.fill);
    glyph(g, e.at[0], e.at[1], e.rows);
    emoteAnims.push({ name, rows: g.rows() });
  }
  const lines = [];
  for (const e of emoteAnims) {
    lines.push(spriteText(`sprite emote_${e.name} 16x16 pivot 8,15 kind emote`, still(e.rows)));
  }
  // Order bubble frame: dish icons are composited in by the view.
  const ob = new Grid(18, 19);
  ob.rect(1, 1, 16, 14, 'h');
  for (const [x, y] of [
    [1, 1],
    [16, 1],
    [1, 14],
    [16, 14],
  ])
    ob.set(x, y, '.');
  ob.rect(8, 15, 9, 16, 'h');
  ob.set(8, 17, 'h');
  ob.outline('k');
  lines.push(spriteText('sprite bubble_order 18x19 pivot 9,18 kind ui', still(ob.rows())));
  writePx('ui/emotes.px', lines.join('\n'));

  const d = ['marinara', 'margherita', 'garlic_bread', 'pepperoni'].map((id) =>
    spriteText(`sprite dish_${id} 12x12 pivot 6,11 kind dish`, still(dish(id).rows())),
  );
  writePx('ui/dishes.px', d.join('\n'));

  // Coin: spin of 4 frames (full, 3/4, edge, 3/4 mirrored look).
  const coinFrame = (hw) => {
    const g = new Grid(7, 7);
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const dx = (x - 3) * (3 / hw);
        const dy = y - 3;
        const dd = dx * dx + dy * dy;
        if (dd <= 7.5) g.set(x, y, dd > 5 ? 't' : 'u');
      }
    if (hw >= 3) {
      g.set(2, 2, 'v');
      g.set(3, 2, 'v');
      g.set(3, 3, 't');
      g.set(3, 4, 't');
    }
    g.outline('k');
    return g.rows().slice(0, 7);
  };
  // outline of a 7x7 coin would need 9x9; draw the coin 5x5-ish inside 7x7 instead.
  const mk = (hw) => {
    const g = new Grid(7, 7);
    const rx = hw;
    for (let y = 1; y <= 5; y++)
      for (let x = 0; x < 7; x++) {
        const dx = (x - 3) / (rx / 2.6);
        const dy = (y - 3) / 2.6;
        if (dx * dx + dy * dy <= 1.05) g.set(x, y, 'u');
      }
    const t = new Grid(7, 7);
    t.c = g.c.map((r) => [...r]);
    g.outline('k');
    if (hw >= 2.4) {
      g.set(2, 2, 'v');
      g.set(3, 2, 'v');
      g.set(3, 3, 't');
      g.set(3, 4, 't');
    }
    return g.rows();
  };
  void coinFrame;
  writePx(
    'ui/coin.px',
    spriteText('sprite coin 7x7 pivot 3,3 kind ui', [
      { name: 'spin', dir: 'none', fps: 8, frames: [mk(3), mk(2.4), mk(1.2), mk(2.4)] },
    ]),
  );

  // Soft shadow ellipse (only translucent sprite).
  const s = new Grid(16, 6);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 16; x++) {
      const dx = (x - 7.5) / 7.6;
      const dy = (y - 2.5) / 2.8;
      if (dx * dx + dy * dy <= 1) s.set(x, y, '~');
    }
  writePx('ui/shadow.px', spriteText('sprite shadow 16x6 pivot 8,3 kind shadow', still(s.rows())));
}
if (process.argv[1] === new URL(import.meta.url).pathname) generateUi();
