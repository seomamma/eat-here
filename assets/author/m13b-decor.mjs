// Decor pieces (M13b): plant, flower box, divider, floor lamp, easel, pillar, statue.
import { blobs, boxes, part, plot, hash, GOLD, proj } from './iso.mjs';
import { glint } from './m13b-lib.mjs';

const LEAF = ['p', 'q', 'r', 's'];
const LEAF_LEVELS = [0.0, 0.22, 0.45];
const leaf = (px, py, info) => {
  // Leaf flecks: darker notches on the shaded half, light ticks on the lit half.
  const n = hash(px, py, 5);
  if (info.lvl >= 2 && n < 120) return 's';
  if (info.lvl <= 1 && n < 150) return 'p';
  return undefined;
};

// ---- plant_potted ---------------------------------------------------------------------------
export const plant = {
  id: 'plant_potted',
  w: 1,
  h: 1,
  origin: [16, 33],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const rim = tier >= 1 ? GOLD : { top: 'g', left: 'f', right: 'e' };
    const parts = [
      part({
        i0: 0.26, j0: 0.26, i1: 0.74, j1: 0.74, z0: 0, z1: 8,
        top: 'f', left: 'f', right: 'e',
        decal: (face, a, e) => (face === 'left' ? (e < 1 || (a > 5 && a < 6.5) ? 'e' : e > 6 ? 'g' : undefined) : face === 'right' && e > 6 ? 'f' : undefined),
      }),
      part({
        i0: 0.17, j0: 0.17, i1: 0.83, j1: 0.83, z0: 8, z1: 12,
        ...rim,
        decal: (face, a, e) => {
          if (face === 'top') {
            const di = Math.abs(a - 0.5);
            const dj = Math.abs(e - 0.5);
            return di < 0.27 && dj < 0.27 ? 'a' : undefined;
          }
          return undefined;
        },
      }),
      blobs({
        ox, oy, sort: [0.3, 0.3, 11], levels: LEAF_LEVELS,
        clusters: [
          { ci: 0.5, cj: 0.5, cz: 22, ri: 0.46, rj: 0.46, rz: 10, ramp: LEAF, tex: (i) => leaf(i.px, i.py, i) },
          { ci: 0.28, cj: 0.62, cz: 17, ri: 0.32, rj: 0.32, rz: 7, ramp: LEAF, tex: (i) => leaf(i.px, i.py, i) },
          { ci: 0.74, cj: 0.36, cz: 19, ri: 0.32, rj: 0.32, rz: 7, ramp: LEAF, tex: (i) => leaf(i.px, i.py, i) },
          { ci: 0.5, cj: 0.5, cz: 29, ri: 0.3, rj: 0.3, rz: 7, ramp: LEAF, tex: (i) => leaf(i.px, i.py, i) },
        ],
      }),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          // Blossoms on the leaves, then two glints.
          const p = (i, j, z, c1, c2) => {
            const s = proj(i, j, z);
            g.set(ox + Math.round(s.x), oy + Math.round(s.y), c1);
            g.set(ox + Math.round(s.x) + 1, oy + Math.round(s.y), c2);
          };
          p(0.62, 0.7, 20, 'n', 'W');
          p(0.35, 0.78, 14, 'u', 'v');
          p(0.78, 0.5, 26, 'W', 'v');
          p(0.46, 0.8, 26, 'n', 'W');
          glint(g, ox - 8, oy - 24, frame === 0);
          glint(g, ox + 8, oy - 28, frame === 1);
        }),
      );
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- flower_box -----------------------------------------------------------------------------
export const flowerBox = {
  id: 'flower_box',
  w: 1,
  h: 1,
  origin: [16, 21],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const band = tier >= 1 ? 'u' : 'b';
    const parts = [
      part({
        i0: 0.08, j0: 0.18, i1: 0.92, j1: 0.82, z0: 0, z1: 8,
        top: 'a', left: 'c', right: 'b',
        decal: (face, a, e) => {
          if (face === 'top') return 'a';
          if (e < 1) return 'a';
          if (e >= 6 && e < 8) return band === 'u' ? (face === 'left' ? 'u' : 't') : face === 'left' ? 'd' : 'c';
          // plank seams
          if (face === 'left' && Math.floor(a) % 5 === 4) return 'b';
          if (face === 'right' && Math.floor(a) % 5 === 4) return 'a';
          return undefined;
        },
      }),
      blobs({
        ox, oy, sort: [0.3, 0.3, 8], levels: LEAF_LEVELS,
        clusters: [
          { ci: 0.28, cj: 0.5, cz: 9, ri: 0.26, rj: 0.26, rz: 5, ramp: ['p', 'q', 'r', 's'], tex: (i) => leaf(i.px, i.py, i) },
          { ci: 0.55, cj: 0.46, cz: 10, ri: 0.3, rj: 0.28, rz: 6, ramp: ['p', 'q', 'r', 's'], tex: (i) => leaf(i.px, i.py, i) },
          { ci: 0.78, cj: 0.52, cz: 9, ri: 0.24, rj: 0.26, rz: 5, ramp: ['p', 'q', 'r', 's'], tex: (i) => leaf(i.px, i.py, i) },
        ],
      }),
      plot((g) => {
        const bloom = (i, j, z, c1, c2) => {
          const s = proj(i, j, z);
          const x = ox + Math.round(s.x);
          const y = oy + Math.round(s.y);
          g.set(x, y, c1);
          g.set(x + 1, y, c1);
          g.set(x, y - 1, c2);
          g.set(x + 1, y - 1, c2);
          g.set(x, y + 1, 'k');
        };
        bloom(0.24, 0.62, 12, 'm', 'n');
        bloom(0.5, 0.7, 13, 'W', 'v');
        bloom(0.7, 0.62, 13, 'u', 'v');
        bloom(0.4, 0.4, 14, 'n', 'W');
        bloom(0.8, 0.45, 12, 'm', 'n');
        if (tier >= 2) {
          bloom(0.58, 0.38, 15, 'u', 'v');
          bloom(0.3, 0.5, 15, 'W', 'v');
          glint(g, ox - 9, oy - 7, frame === 0);
          glint(g, ox + 9, oy - 9, frame === 1);
        }
      }, [0.8, 0.8, 20]),
    ];
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- divider (half wall) --------------------------------------------------------------------
export const divider = {
  id: 'divider',
  w: 1,
  h: 1,
  origin: [16, 25],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const cap = tier >= 1 ? GOLD : { top: 'd', left: 'c', right: 'b' };
    const parts = [
      part({
        i0: 0.02, j0: 0.36, i1: 0.98, j1: 0.64, z0: 0, z1: 3,
        top: 'c', left: 'b', right: 'a',
      }),
      part({
        i0: 0.06, j0: 0.4, i1: 0.94, j1: 0.6, z0: 3, z1: 16,
        top: 'i', left: 'h', right: 'i',
        decal: (face, a, e) => {
          if (face === 'top') return undefined;
          if (back) {
            // Plaster with a brick band at the foot.
            if (e < 4) return Math.floor(e / 2) % 2 === 0 ? (face === 'left' ? 'f' : 'e') : face === 'left' ? 'g' : 'f';
            return face === 'left' ? 'h' : 'i';
          }
          // Wooden slats.
          const slat = Math.floor(a / 3) % 2 === 0;
          if (face === 'left') return slat ? 'c' : 'd';
          return slat ? 'b' : 'c';
        },
      }),
      part({
        i0: 0.02, j0: 0.36, i1: 0.98, j1: 0.64, z0: 16, z1: 19,
        ...cap,
      }),
    ];
    if (tier >= 2) {
      for (const i of [0.02, 0.8])
        parts.push(part({ i0: i, j0: 0.36, i1: i + 0.18, j1: 0.64, z0: 19, z1: 24, ...GOLD }));
      parts.push(
        plot((g) => {
          glint(g, ox - 10, oy - 9, frame === 0);
          glint(g, ox + 12, oy - 6, frame === 1);
        }),
      );
    }
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- floor_lamp -----------------------------------------------------------------------------
export const lamp = {
  id: 'floor_lamp',
  w: 1,
  h: 1,
  origin: [16, 37],
  draw(view, tier, frame, lit = false) {
    const [ox, oy] = this.origin;
    const metal = tier >= 1 ? GOLD : { top: 'K', left: 'x', right: 'w' };
        const parts = [
      part({ i0: 0.3, j0: 0.3, i1: 0.7, j1: 0.7, z0: 0, z1: 3, ...metal }),
      part({ i0: 0.46, j0: 0.46, i1: 0.54, j1: 0.54, z0: 3, z1: 30, ...metal }),
      blobs({
        ox, oy, sort: [0.3, 0.3, 30], levels: [0.05, 0.3, 0.55],
        clusters: [{ ci: 0.5, cj: 0.5, cz: 31, ri: 0.4, rj: 0.4, rz: 9, zmin: 31, ramp: lit ? ['u', 'v', 'W', 'W'] : ['t', 'u', 'v', 'W'] }],
      }),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          glint(g, ox - 11, oy - 27, frame === 0);
          glint(g, ox + 10, oy - 18, frame === 1);
        }),
      );
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- painting_easel -------------------------------------------------------------------------
export const easel = {
  id: 'painting_easel',
  w: 1,
  h: 1,
  origin: [16, 33],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const j0 = back ? 0.6 : 0.3;
    const frameTone = tier >= 1 ? GOLD : { top: 'd', left: 'c', right: 'b' };
    const leg = { top: 'c', left: 'b', right: 'a' };
    const parts = [
      // Easel legs: two in front, one behind (a tripod).
      part({ i0: 0.1, j0: back ? 0.55 : 0.2, i1: 0.2, j1: back ? 0.65 : 0.3, z0: 0, z1: 24, ...leg }),
      part({ i0: 0.8, j0: back ? 0.55 : 0.2, i1: 0.9, j1: back ? 0.65 : 0.3, z0: 0, z1: 24, ...leg }),
      part({ i0: 0.45, j0: back ? 0.12 : 0.74, i1: 0.55, j1: back ? 0.22 : 0.84, z0: 0, z1: 20, ...leg }),
      // Canvas on its board: a framed panel facing +j.
      part({
        i0: 0.08, j0, i1: 0.92, j1: j0 + 0.08, z0: 10, z1: 31,
        ...frameTone,
        decal: (face, a, e) => {
          if (face !== 'left') return undefined;
          const w = 13.4;
          const inside = a >= 1.5 && a < w - 1.5 && e >= 1.5 && e < 19.5;
          if (!inside) return tier >= 1 ? (e < 1 || e > 19.5 ? 't' : undefined) : undefined;
          if (back) return a % 6 < 1 || e % 10 < 1 ? 'a' : 'b';
          // Landscape: sky, sun, hills, a hut with a red roof.
          const y = e - 1.5;
          const x = a - 1.5;
          if (y > 12) return Math.hypot(x - 8, y - 15.5) < 2.2 ? 'v' : 'z';
          if (y > 8 + Math.sin(x * 0.55) * 1.6) return x > 3 && x < 7 && y < 10.5 ? 'm' : 'y';
          if (y > 5.5) return x > 3 && x < 7 && y < 8 ? 'h' : 'r';
          return Math.floor((x + y) / 2) % 2 === 0 ? 'q' : 'r';
        },
      }),
      // Tray shelf.
      part({ i0: 0.06, j0: back ? 0.5 : 0.2, i1: 0.94, j1: back ? 0.7 : 0.42, z0: 7, z1: 10, top: 'c', left: 'b', right: 'a' }),
    ];
    if (tier >= 2) {
      parts.push(
        part({ i0: 0.38, j0: j0 - 0.02, i1: 0.62, j1: j0 + 0.1, z0: 31, z1: 34, ...GOLD }),
        plot((g) => {
          glint(g, ox - 11, oy - 24, frame === 0);
          glint(g, ox + 12, oy - 13, frame === 1);
        }),
      );
    }
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- pillar ---------------------------------------------------------------------------------
export const pillar = {
  id: 'pillar',
  w: 1,
  h: 1,
  origin: [16, 37],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const gold = tier >= 1;
    const flute = (face, a) => {
      if (face === 'top') return undefined;
      const k = Math.floor(a) % 4;
      if (face === 'left') return k === 0 ? 'j' : k === 1 || k === 2 ? 'h' : 'i';
      return k === 0 ? 'j' : k === 3 ? 'j' : 'i';
    };
    const parts = [
      part({ i0: 0.1, j0: 0.1, i1: 0.9, j1: 0.9, z0: 0, z1: 3, top: 'h', left: 'i', right: 'j' }),
      part({ i0: 0.16, j0: 0.16, i1: 0.84, j1: 0.84, z0: 3, z1: 6, ...(gold ? GOLD : { top: 'h', left: 'i', right: 'j' }) }),
      part({ i0: 0.24, j0: 0.24, i1: 0.76, j1: 0.76, z0: 6, z1: 38, top: 'h', left: 'h', right: 'i', decal: flute }),
      part({ i0: 0.16, j0: 0.16, i1: 0.84, j1: 0.84, z0: 38, z1: 41, ...(gold ? GOLD : { top: 'h', left: 'i', right: 'j' }) }),
      part({ i0: 0.08, j0: 0.08, i1: 0.92, j1: 0.92, z0: 41, z1: 45, top: 'W', left: 'h', right: 'i',
        decal: (face, a, e) => (face !== 'top' && e < 1 ? 'j' : undefined) }),
    ];
    if (tier >= 2) {
      parts.push(
        plot((g) => {
          // A tomato-red gem on the capital and two glints.
          const s = proj(0.5, 0.92, 42);
          const x = ox + Math.round(s.x);
          const y = oy + Math.round(s.y);
          g.rect(x - 1, y - 1, x, y, 'm');
          g.set(x - 1, y - 1, 'n');
          glint(g, ox - 9, oy - 26, frame === 0);
          glint(g, ox + 10, oy - 18, frame === 1);
        }),
      );
    }
    return boxes(1, 1, ox, oy, parts);
  },
};

// ---- statue ---------------------------------------------------------------------------------
const PIZZA = ['.kkkk.', 'kuvvuk', 'kmuvmk', '.kkkk.'];
export const statue = {
  id: 'statue',
  w: 1,
  h: 1,
  origin: [16, 45],
  draw(view, tier, frame) {
    const [ox, oy] = this.origin;
    const back = view === 'back';
    const gilded = tier >= 2;
    const ramp = gilded ? ['t', 'u', 'v', 'W'] : ['y', 'z', 'W', 'W'];
    const plinth = tier >= 1 ? GOLD : { top: 'h', left: 'i', right: 'j' };
    const fold = (info) => {
      // Robe folds: slim vertical shade lines.
      const k = Math.floor(info.phi * 5.2 + 20) % 3;
      return k === 0 ? ramp[Math.max(0, info.lvl - 1)] : undefined;
    };
    const parts = [
      part({ i0: 0.1, j0: 0.1, i1: 0.9, j1: 0.9, z0: 0, z1: 4, top: 'i', left: 'h', right: 'j' }),
      part({ i0: 0.2, j0: 0.2, i1: 0.8, j1: 0.8, z0: 4, z1: 11, top: 'h', left: 'W', right: 'i',
        decal: (face, a, e) => {
          if (face === 'left' && !back && tier >= 1 && a > 3 && a < 9 && e > 2.5 && e < 5.5) return a < 4 || a > 8 || e < 3.5 || e > 4.5 ? 't' : 'v';
          return undefined;
        } }),
      part({ i0: 0.14, j0: 0.14, i1: 0.86, j1: 0.86, z0: 11, z1: 14, ...plinth }),
      blobs({
        ox, oy, sort: [0.3, 0.3, 14], levels: [0.0, 0.25, 0.5],
        clusters: [
          // Robe, shoulders, head, raised arm.
          { ci: 0.5, cj: 0.5, cz: 22, ri: 0.4, rj: 0.36, rz: 11, zmin: 14, ramp, tex: fold },
          { ci: 0.5, cj: 0.5, cz: 31, ri: 0.34, rj: 0.3, rz: 4.5, ramp },
          { ci: 0.5, cj: 0.5, cz: 41, ri: 0.2, rj: 0.2, rz: 5.5, ramp },
          { ci: 0.86, cj: 0.4, cz: 36, ri: 0.09, rj: 0.09, rz: 7, ramp },
          { ci: 0.18, cj: 0.62, cz: 28, ri: 0.09, rj: 0.09, rz: 7, ramp },
          { ci: 0.5, cj: 0.5, cz: 49, ri: 0.24, rj: 0.22, rz: 6, ramp },
          { ci: 0.5, cj: 0.5, cz: 45, ri: 0.22, rj: 0.2, rz: 2.5, ramp },
        ],
      }),
      plot((g) => {
        // The baker holds a pizza aloft.
        const s = proj(0.86, 0.4, 46);
        g.put(ox + Math.round(s.x) - 3, oy + Math.round(s.y) - 3, PIZZA);
        if (back) return;
        const f = proj(0.5, 0.7, 41);
        const x = ox + Math.round(f.x);
        const y = oy + Math.round(f.y);
        g.set(x - 2, y, gilded ? 't' : 'x');
        g.set(x + 1, y, gilded ? 't' : 'x');
      }, [0.9, 0.9, 40]),
    ];
    if (tier >= 2)
      parts.push(
        plot((g) => {
          glint(g, ox - 10, oy - 28, frame === 0);
          glint(g, ox + 12, oy - 40, frame === 1);
        }, [1, 1, 60]),
      );
    return boxes(1, 1, ox, oy, parts);
  },
};

export const DECOR = [plant, flowerBox, divider, lamp, easel, pillar, statue];
