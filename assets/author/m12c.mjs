// Draft generator for the M12c art: kids (12x18), dogs, the high chair and the broken-heart emote
// (assets/sprites/**). Like the other generators it drafts the maps once; after that the .px
// files are edited directly (re-running overwrites hand edits).
import { Grid, spriteText, writePx } from './lib.mjs';
import { boxes, part, legs } from './world.mjs';

// ---- kids ---------------------------------------------------------------------------------------
const KID_HEAD = {
  front: ['.aaaaaa.', 'abbaaaaa', 'aaaaaaaa', 'BBBBBBBB', 'BkBBBBkB', 'BBBBBBBB', '.CBBBBC.'],
  back: ['.aaaaaa.', 'abbaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', '.aaaaaa.'],
};
const KID_TORSO = {
  front: ['nmBBmm', 'nmmmml', 'nmmmml', 'nmmmml', 'wwwwww'],
  back: ['nmCCmm', 'nmmmml', 'nmmmml', 'nmmmml', 'wwwwww'],
};

function kid(facing, pose = {}) {
  const g = new Grid(12, 18);
  const dy = pose.dy ?? 0;
  const top = dy + (pose.sit ? 3 : 0);
  if (pose.sit) {
    // Lap on the chair; the chair hides the rest.
    g.rect(3, 16, 8, 16, 'w');
  } else {
    const spread = pose.legs === 'spread' ? 1 : 0;
    const lift = { L: pose.legs === 'liftL' ? 1 : 0, R: pose.legs === 'liftR' ? 1 : 0 };
    const leg = (x, l) => {
      g.rect(x, 13, x + 1, 14 - l, 'w');
      g.set(x, 13, 'x');
      g.rect(x, 15 - l, x + 1, 15 - l, 'B');
      g.rect(x, 16 - l, x + 1, 16 - l, 'a');
    };
    leg(3 - spread, lift.L);
    leg(7 + spread, lift.R);
  }
  g.put(3, 8 + top, KID_TORSO[facing]);
  // Arms: sleeves and hands.
  const arm = (x, mode, left) => {
    const y0 = 9 + top + (mode === 'up1' ? -1 : mode === 'dn1' ? 1 : 0);
    g.rect(x, y0, x, y0 + 2, left ? 'm' : 'm');
    g.set(x, y0, left ? 'n' : 'm');
    g.set(x, y0 + 2, left ? 'm' : 'l');
    g.set(x, y0 + 3, 'B');
  };
  arm(2, pose.armL ?? 'down', true);
  if (pose.armR === 'raise') {
    const hy = pose.wave ? 4 : 3;
    g.rect(10, 5 + top, 10, 8 + top, 'm');
    g.rect(10, hy + top, 10, hy + 1 + top, 'B');
  } else if (pose.armR === 'eat') {
    g.rect(10, 7 + top, 10, 9 + top, 'm');
    g.set(10, 6 + top, 'B');
    g.set(10, 5 + top, 'u');
    g.set(10, 4 + top, 't');
  } else arm(9, pose.armR ?? 'down', false);
  if (pose.sit && !pose.armR) {
    // Forearms rest on the table.
    g.set(2, 15, 'B');
    g.set(9, 15, 'B');
  }
  g.put(2, 1 + top, KID_HEAD[facing]);
  g.outline('k');
  return g.rows();
}

const KID_WALK = [
  { dy: 1, legs: 'spread', armL: 'up1', armR: 'dn1' },
  { dy: 0, legs: 'liftR' },
  { dy: 1, legs: 'spread', armL: 'dn1', armR: 'up1' },
  { dy: 0, legs: 'liftL' },
];

function kidAnims() {
  const out = [];
  const set = (name, fps, poses, only) => {
    for (const facing of ['front', 'back']) {
      if (only && only !== facing) continue;
      out.push({ name, dir: facing, fps, frames: poses.map((p) => kid(facing, p)) });
    }
  };
  set('idle', 2, [{}, { dy: 1 }]);
  set('walk', 8, KID_WALK);
  set('sit', 2, [{ sit: true }]);
  set('eat', 2, [{ sit: true }, { sit: true, armR: 'eat' }]);
  set('hand', 3, [
    { sit: true, armR: 'raise' },
    { sit: true, armR: 'raise', wave: true },
  ]);
  return out;
}

// ---- dogs ---------------------------------------------------------------------------------------
// 14x10, pivot at the feet. Front = heading down-right (we see the face), back = heading up-right.
function dog(facing, f = 0, pose = 'walk') {
  const g = new Grid(14, 10);
  const wag = f % 2;
  const stepA = [
    [4, 10],
    [5, 9],
    [4, 10],
    [5, 9],
  ][f % 4];
  if (facing === 'front') {
    // tail (upper left), body, head with ears (right), legs
    g.put(1, 2 - wag, ['ZZ', '.ZZ']);
    g.put(3, 3, ['.ZZZZZ', 'ZZZZZZ', 'ZZQZZZ']);
    g.put(
      7,
      2,
      ['.QZZZZ.', '.QZZZZZ', '..ZkZkZ', '..ZZhhh', '...ZkkZ'].map((r) => r.padEnd(7, '.')),
    );
    if (pose === 'walk') {
      g.rect(stepA[0], 6, stepA[0] + 1, 7, 'Z');
      g.rect(stepA[1], 6, stepA[1] + 1, 7, 'Z');
      g.set(stepA[0], 7, 'Q');
    } else {
      g.rect(4, 6, 5, 7, 'Z');
      g.rect(9, 6, 10, 7, 'Z');
    }
  } else {
    // heading away: rump and tail in front, head small at the top right
    g.put(8, 1, ['.QZZ', 'QZZZ', '.ZZZ']);
    g.put(2, 3, ['.ZZZZZZZ', 'ZZZZZZZZZ', 'ZZQZZZZZ']);
    g.put(
      1,
      1 - 0,
      ['.Z', 'ZZ'].map((r) => r),
    ); // tail tip
    g.set(1, 2 - wag, 'Z');
    g.set(1, 3 - wag, 'Z');
    if (pose === 'walk') {
      g.rect(stepA[0] - 1, 6, stepA[0], 7, 'Z');
      g.rect(stepA[1], 6, stepA[1] + 1, 7, 'Z');
    } else {
      g.rect(3, 6, 4, 7, 'Z');
      g.rect(8, 6, 9, 7, 'Z');
    }
  }
  g.outline('k');
  // Feet go on the baseline row.
  return ['.'.repeat(14), ...g.rows().slice(0, 9)];
}

function dogAnims() {
  const out = [];
  for (const facing of ['front', 'back']) {
    out.push({
      name: 'walk',
      dir: facing,
      fps: 8,
      frames: [0, 1, 2, 3].map((f) => dog(facing, f, 'walk')),
    });
    out.push({
      name: 'idle',
      dir: facing,
      fps: 3,
      frames: [0, 1].map((f) => dog(facing, f, 'idle')),
    });
  }
  return out;
}

// ---- high chair ---------------------------------------------------------------------------------
function highChair(back) {
  return boxes(1, 1, 16, 19, [
    ...legs(0.22, 0.22, 0.78, 0.78, 8, 0.12),
    part({ i0: 0.2, j0: 0.2, i1: 0.8, j1: 0.8, z0: 8, z1: 11, top: 'v', left: 'u', right: 't' }),
    // Tall back and a tray bar across the front.
    part({
      i0: 0.2,
      j0: back ? 0.68 : 0.2,
      i1: 0.8,
      j1: back ? 0.8 : 0.32,
      z0: 11,
      z1: 22,
      top: 'v',
      left: 'u',
      right: 't',
    }),
    part({
      i0: 0.16,
      j0: back ? 0.1 : 0.6,
      i1: 0.84,
      j1: back ? 0.4 : 0.9,
      z0: 13,
      z1: 14,
      top: 'd',
      left: 'c',
      right: 'b',
    }),
  ]);
}

// ---- broken heart emote ---------------------------------------------------------------------------
function brokenHeart() {
  const g = new Grid(16, 16);
  g.rect(1, 1, 14, 11, 'h');
  for (const [x, y] of [
    [1, 1],
    [14, 1],
    [1, 11],
    [14, 11],
  ])
    g.set(x, y, '.');
  g.rect(7, 12, 8, 13, 'h');
  g.set(7, 14, 'h');
  g.outline('k');
  const heart = [
    [3, 5, 6],
    [3, 9, 10],
    [4, 4, 11],
    [5, 4, 11],
    [6, 5, 10],
    [7, 6, 9],
    [8, 7, 8],
  ];
  for (const [y, x0, x1] of heart) for (let x = x0; x <= x1; x++) g.set(x, y, 'm');
  g.set(5, 4, 'n');
  // The crack and the two halves drifting apart.
  for (const [x, y] of [
    [7, 3],
    [8, 4],
    [7, 5],
    [8, 6],
    [7, 7],
  ])
    g.set(x, y, 'k');
  g.set(8, 3, 'h');
  g.set(7, 8, 'h');
  g.set(8, 8, 'h');
  return g.rows();
}

export function generateM12c() {
  writePx(
    'characters/kid.px',
    spriteText(
      'sprite kid 12x18 pivot 6,17 kind kid',
      kidAnims(),
      [
        '# Palette-swapped kids: skin, hair and shirt change; shapes are shared.',
        'variant kid1 B=E C=F a=u b=v m=q n=r l=p',
        'variant kid2 B=A C=B a=Q b=Z m=x n=y l=w w=a x=b',
      ].join('\n'),
    ),
  );
  writePx(
    'characters/dog.px',
    spriteText(
      'sprite dog 14x10 pivot 7,9 kind critter',
      dogAnims(),
      ['# A grey dog.', 'variant dog1 Z=J Q=K'].join('\n'),
    ),
  );
  const fur = (name, anims) => spriteText(`sprite ${name} 32x35 pivot 16,19 kind prop`, anims);
  const A = (rows, dir) => ({ name: 'still', dir, fps: 1, frames: [rows] });
  writePx(
    'world/chair_high.px',
    fur('chair_high', [A(highChair(false).rows(), 'front'), A(highChair(true).rows(), 'back')]),
  );
  writePx(
    'ui/emote_heartbroken.px',
    spriteText('sprite emote_heartbroken 16x16 pivot 8,15 kind emote', [
      { name: 'still', dir: 'none', fps: 1, frames: [brokenHeart()] },
    ]),
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) generateM12c();
