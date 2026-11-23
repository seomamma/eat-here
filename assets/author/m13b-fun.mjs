// Fun pieces (M13b): vending machine, piano, toilet cabin.
import { blobs, boxes, part, plot, proj } from './iso.mjs';
import { glint } from './m13b-lib.mjs';

// ---- vending_machine ------------------------------------------------------------------------
const PRODUCTS = ['u', 'W', 'n', 'r', 'y', 'v', 'm', 'z'];
export const vending = {
  id: 'vending_machine',
  w: 1,
  h: 1,
  origin: [16, 29],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const gold = tier >= 1;
    const trim = gold ? 'u' : 'l';
    const parts = [
      part({
        i0: 0.1, j0: 0.12, i1: 0.9, j1: 0.88, z0: 0, z1: 34,
        top: 'n', left: 'm', right: 'l',
        decal: (face, a, e) => {
          if (face === 'top') return undefined;
          if (face === 'right') {
            if (e < 1 || a < 0.8 || a > 11.2) return 'e';
            if (!back) {
              // Side vents and a sticker.
              if (e > 8 && e < 17 && Math.floor(e) % 2 === 0 && a > 2 && a < 10) return 'e';
              if (e > 22 && e < 28 && a > 3 && a < 9) return e > 23 && e < 27 && a > 4 && a < 8 ? 'v' : 'u';
            } else if (e > 6 && e < 24 && Math.floor(e) % 2 === 0 && a > 2 && a < 10) return 'e';
            return undefined;
          }
          // left face
          if (back) {
            if (a < 1 || a > 11.8 || e < 1) return 'l';
            if (e > 6 && e < 26 && Math.floor(e) % 3 === 0 && a > 2 && a < 11) return 'l';
            if (e > 28 && e < 31) return 'e';
            return undefined;
          }
          if (a < 0.9) return 'n';
          if (e < 1) return 'l';
          // Lit sign on top.
          if (e >= 30.5) {
            if (a > 1 && a < 11.8) {
              const on = Math.floor(a + e) % 2 === 0;
              return tier >= 2 ? (Math.floor(a / 2) % 2 === frame ? 'W' : 'v') : on ? 'v' : 'u';
            }
            return trim;
          }
          if (e >= 29.5) return trim;
          // Window with products.
          if (a >= 1.4 && a < 8.6 && e >= 11 && e < 29.5) {
            if (a < 1.9 || a >= 8.1 || e >= 28.9) return gold ? 'u' : 'w';
            const row = Math.floor((e - 11) / 5.6);
            const within = (e - 11) % 5.6;
            if (within > 4.2) return 'x'; // shelf
            const col = Math.floor((a - 1.9) / 2);
            const c = PRODUCTS[(col * 3 + row * 2) % PRODUCTS.length];
            return within < 1 ? 'w' : within > 3.2 ? 'x' : c;
          }
          // Control panel on the right of the face.
          if (a >= 9 && a < 11.8 && e >= 11 && e < 29.5) {
            if (e > 25) return gold ? 'u' : 'y'; // coin slot
            const led = Math.floor((e - 11) / 4);
            if (a > 9.6 && a < 11.2 && (e - 11) % 4 > 0.6 && (e - 11) % 4 < 2.4 && led < 3) {
              return led === 0 ? (frame === 0 ? 'r' : 's') : led === 1 ? (frame === 0 ? 'm' : 'n') : 'W';
            }
            return 'w';
          }
          // Dispense slot.
          if (a >= 2 && a < 8 && e >= 3 && e < 9) return e < 4 || e > 7.5 || a < 2.6 || a > 7.4 ? 'w' : 'k';
          return undefined;
        },
      }),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          glint(g, ox - 10, oy - 28, frame === 0);
          glint(g, ox + 10, oy - 22, frame === 1);
        }),
      );
    return boxes(1, 1, ox, oy, parts);
  },
};
vending.extra = [
  {
    name: 'blink',
    dir: 'front',
    fps: 2,
    frames: [vending.draw('front', 0, 0), vending.draw('front', 0, 1)],
  },
];

// ---- piano ----------------------------------------------------------------------------------
export const piano = {
  id: 'piano',
  w: 2,
  h: 1,
  origin: [16, 28],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const gold = tier >= 1;
    const parts = [
      // Lower cabinet in warm wood with two pedals.
      part({
        i0: 0.04, j0: 0.22, i1: 1.96, j1: 0.8, z0: 0, z1: 11,
        top: 'c', left: 'b', right: 'a',
        decal: (face, a, e) => {
          if (face === 'top') return undefined;
          if (face === 'left') {
            if (e < 1) return 'a';
            if (!back) {
              if ((a > 13.5 && a < 16) || (a > 18 && a < 20.5)) return e > 1.5 && e < 3.5 ? (gold ? 'v' : 'u') : undefined;
              if (a > 3 && a < 29 && e > 4 && e < 10 && (a < 3.8 || a > 28.2 || e > 9.2 || e < 4.8)) return 'a';
              return undefined;
            }
            if (e > 4 && e < 10 && Math.floor(a / 6) % 2 === 0) return 'a';
            return undefined;
          }
          return undefined;
        },
      }),
      // Keyboard shelf (front only): white keys with black ones.
      ...(back
        ? []
        : [
            part({
              i0: 0.08, j0: 0.8, i1: 1.92, j1: 0.96, z0: 9, z1: 11.5,
              top: 'W', left: 'd', right: 'c',
              decal: (face, a, e, px) => {
                if (face !== 'top') return gold && face === 'left' && e > 1.5 ? 'u' : undefined;
                if (e < 0.87 && [1, 2, 4, 5, 6].includes(Math.floor(px / 2) % 7)) return 'k';
                return px % 2 === 0 ? 'z' : undefined;
              },
            }),
          ]),
      // Upper case in black with a music rack.
      part({
        i0: 0.04, j0: 0.22, i1: 1.96, j1: 0.76, z0: 11, z1: 27,
        top: 'w', left: 'w', right: 'k',
        decal: (face, a, e) => {
          if (face === 'top') return undefined;
          if (face === 'right') return a < 1 ? 'K' : undefined;
          if (back) {
            if (a < 1.5 || a > 30.5) return 'K';
            return e > 2 && e < 14 && Math.floor(a / 8) % 2 === 0 ? 'k' : 'w';
          }
          if (a < 1.2 || a > 30.8) return 'K'; // sheen on the corners
          if (e > 2 && e < 10 && a > 9 && a < 23) {
            // Sheet music on the rack.
            if (e < 2.8 || a < 9.8 || a > 22.2) return 'j';
            return Math.floor(e) % 2 === 0 ? 'h' : 'i';
          }
          if (e > 12.5 && e < 13.5 && a > 2 && a < 30) return gold ? 'u' : 'x';
          if (e > 14.5 && e < 15.2 && a > 2 && a < 30) return 'x';
          return undefined;
        },
      }),
      // Lid in warm wood.
      part({
        i0: 0.0, j0: 0.18, i1: 2.0, j1: 0.8, z0: 27, z1: 29.5,
        top: 'd', left: gold ? 'u' : 'c', right: gold ? 't' : 'b',
      }),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          // Two candles on the lid: cream stick, flame flickers between frames.
          for (const [i, j] of [[0.35, 0.5], [1.65, 0.5]]) {
            const s = proj(i, j, 29.5);
            const x = ox + Math.round(s.x);
            const y = oy + Math.round(s.y);
            g.rect(x - 1, y - 5, x, y, 'h');
            g.set(x, y - 5, 'i');
            g.rect(x - 1, y - 6, x, y - 6, 'k');
            g.set(x - 1, y - 7 - frame, 'u');
            g.set(x - 1, y - 8 - frame, 'v');
            g.set(x, y - 7 - frame, 'v');
          }
          glint(g, ox - 14, oy - 22, frame === 0);
          glint(g, ox + 17, oy - 18, frame === 1);
        }, [2, 1, 99]),
      );
    return boxes(2, 1, ox, oy, parts);
  },
};

// ---- toilet cabin ---------------------------------------------------------------------------
const PLATE = [
  'FFFFFFFFFFF',
  'FBBBBBBBBBF',
  'FBWBWBWWWBF',
  'FBWBWBWBBBF',
  'FBWWWBWBBBF',
  'FBWWWBWBBBF',
  'FBWBWBWWWBF',
  'FBBBBBBBBBF',
  'FFFFFFFFFFF',
];
export const toilet = {
  id: 'toilet',
  w: 1,
  h: 1,
  origin: [16, 35],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const gold = tier >= 1;
    const parts = [
      part({
        i0: 0.08, j0: 0.08, i1: 0.92, j1: 0.92, z0: 0, z1: 31,
        top: 'c', left: 'c', right: 'b',
        decal: (face, a, e) => {
          if (face === 'top') return undefined;
          if (face === 'right') {
            if (e < 1) return 'a';
            if (Math.floor(a) % 4 === 3) return 'a';
            return Math.floor(a) % 4 === 0 ? 'c' : undefined;
          }
          // left face: the door
          if (e < 1) return 'a';
          if (a < 0.9 || a > 12.5) return 'b';
          if (back) {
            if (Math.floor(a) % 4 === 3) return 'b';
            if (e > 21 && e < 27 && a > 3.5 && a < 9.5) return e < 22 || e > 26 || a < 4.5 || a > 8.5 ? 'a' : 'y';
            return undefined;
          }
          // Louvre slats above, door panel below.
          if (e > 16 && e < 24) return Math.floor(e) % 2 === 0 ? 'a' : 'd';
          if (e >= 24 && e < 24.9) return 'a';
          // door panel frame and handle
          if (e > 14.5 && e < 15.5 && a > 1.5 && a < 11.5) return 'b';
          if (a > 1.2 && a < 12 && e > 1.2) {
            const handle = a > 9.6 && a < 11 && e > 8 && e < 10.4;
            if (handle) return gold ? 'v' : 'K';
            return 'd';
          }
          return undefined;
        },
      }),
      // The "WC" plate above the door, sheared with the wall (one pixel down every two columns).
      ...(back
        ? []
        : [
            plot((g) => {
              const x0 = ox - 11;
              const y0 = oy - 21;
              const plate = PLATE;
              plate.forEach((row, ry) =>
                [...row].forEach((c, rx) => {
                  if (c === '.') return;
                  const col = c === 'F' ? (gold ? 'u' : 'w') : c === 'B' ? (gold ? 'w' : 'x') : 'W';
                  g.set(x0 + rx, y0 + ry + Math.floor(rx / 2), col);
                }),
              );
            }, [0.9, 0.9, 40]),
          ]),
      // Roof slab.
      part({
        i0: 0.03, j0: 0.03, i1: 0.97, j1: 0.97, z0: 31, z1: 34,
        top: gold ? 'v' : 'd', left: gold ? 'u' : 'c', right: gold ? 't' : 'b',
      }),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          // A golden star on the roof.
          const s = proj(0.5, 0.5, 34);
          const x = ox + Math.round(s.x);
          const y = oy + Math.round(s.y);
          g.rect(x - 1, y - 3, x, y - 2, 'v');
          g.rect(x - 3, y - 2, x + 2, y - 2, 'u');
          g.set(x - 1, y - 4, 'W');
          g.set(x, y - 4, 'v');
          glint(g, ox - 11, oy - 22, frame === 0);
          glint(g, ox + 11, oy - 28, frame === 1);
        }, [1, 1, 99]),
      );
    return boxes(1, 1, ox, oy, parts);
  },
};

export const FUN = [vending, piano, toilet];
void blobs;
