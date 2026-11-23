// Shared iso drawing helpers for the M13b drafts (assets/author/m13b.mjs). Palette chars only.
// The .px files in assets/sprites/ are the source of truth; these helpers only draft them.
import { Grid } from './lib.mjs';
import { boxes, part, legs, hash } from './world.mjs';

export { Grid, boxes, part, legs, hash };

/** Screen position (relative to the sprite origin ox,oy) of a point in tile units (i,j) and height z (px). */
export const proj = (i, j, z) => ({ x: (i - j) * 16, y: (i + j) * 8 - z });

/** Light from the top-left: left (+j) faces are lit, right (+i) faces shaded. */
export const LIGHT = (() => {
  const L = [-0.25, 0.45, 0.85];
  const n = Math.hypot(...L);
  return L.map((v) => v / n);
})();
/** Tile units to pixel units for normals, so a sphere of radius r tiles is as tall as 11 r px. */
const S = 11;

/**
 * A z-buffered union of ellipsoids ("clusters"), shaded by their normals and outlined once.
 * cluster: { ci, cj, cz, ri, rj, rz, zmin?, ramp: [dark..light] (>=2 chars), tex?(info) -> char }.
 * Returns a boxes() part. Creases (1 px of the darkest ramp colour) mark where a nearer cluster
 * overlaps a farther one.
 */
export function blobs({ ox, oy, clusters, levels = [0.2, 0.45, 0.7], crease = true, outline = 'k', sort = [0, 0, 99] }) {
  return {
    i0: sort[0],
    j0: sort[1],
    z0: sort[2],
    draw(g) {
      const mask = new Grid(g.w, g.h);
      const id = Array.from({ length: g.h }, () => Array(g.w).fill(-1));
      const depth = Array.from({ length: g.h }, () => Array(g.w).fill(-1e9));
      for (let py = 0; py < g.h; py++)
        for (let px = 0; px < g.w; px++) {
          const a = (px + 0.5 - ox) / 16;
          const Y = py + 0.5 - oy;
          clusters.forEach((c, k) => {
            const f = (t) =>
              ((t / 2 + a / 2 - c.ci) / c.ri) ** 2 +
              ((t / 2 - a / 2 - c.cj) / c.rj) ** 2 +
              ((8 * t - Y - c.cz) / c.rz) ** 2 -
              1;
            const f0 = f(0);
            const A = (f(1) + f(-1)) / 2 - f0;
            const B = (f(1) - f(-1)) / 2;
            const disc = B * B - 4 * A * f0;
            if (disc < 0) return;
            const t = (-B + Math.sqrt(disc)) / (2 * A);
            const i = t / 2 + a / 2;
            const j = t / 2 - a / 2;
            const z = 8 * t - Y;
            if (c.zmin !== undefined && z < c.zmin) return;
            if (t <= depth[py][px]) return;
            const n = [(i - c.ci) / (c.ri * c.ri) / S, (j - c.cj) / (c.rj * c.rj) / S, (z - c.cz) / (c.rz * c.rz)];
            const nl = Math.hypot(...n) || 1;
            const lit = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nl;
            let lvl = 0;
            for (const th of levels) if (lit > th) lvl++;
            lvl = Math.min(lvl, c.ramp.length - 1);
            const info = { px, py, i, j, z, lvl, lit, k, th: Math.acos(Math.min(1, Math.max(-1, (z - c.cz) / c.rz))), phi: Math.atan2((j - c.cj) / c.rj, (i - c.ci) / c.ri) };
            const ch = c.tex?.(info) ?? c.ramp[lvl];
            mask.set(px, py, ch);
            id[py][px] = k;
            depth[py][px] = t;
          });
        }
      if (crease)
        for (let py = 0; py < g.h; py++)
          for (let px = 0; px < g.w; px++) {
            const k = id[py][px];
            if (k < 0) continue;
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
              const k2 = id[py + dy]?.[px + dx];
              if (k2 !== undefined && k2 >= 0 && k2 !== k) {
                // The farther of the two pixels gets the crease colour.
                if (depth[py][px] < depth[py + dy][px + dx]) mask.set(px, py, clusters[k].ramp[0]);
                else mask.set(px + dx, py + dy, clusters[k2].ramp[0]);
              }
            }
          }
      for (let py = 0; py < g.h; py++)
        for (let px = 0; px < g.w; px++) {
          if (mask.get(px, py) === '.') continue;
          const edge =
            mask.get(px - 1, py) === '.' ||
            mask.get(px + 1, py) === '.' ||
            mask.get(px, py - 1) === '.' ||
            mask.get(px, py + 1) === '.';
          g.set(px, py, edge ? outline : mask.get(px, py));
        }
    },
  };
}

/** A part that stamps text rows onto the sprite at screen position (x, y); '.' is transparent. */
export function stamp(x, y, rows, map = {}, sort = [0, 0, 98]) {
  return {
    i0: sort[0],
    j0: sort[1],
    z0: sort[2],
    draw(g) {
      g.put(x, y, rows, map);
    },
  };
}

/** A part that runs fn(g) on the sprite grid (direct pixel plotting). */
export function plot(fn, sort = [0, 0, 99.5]) {
  return { i0: sort[0], j0: sort[1], z0: sort[2], draw: fn };
}

/** Gold box tones (cheese ramp). */
export const GOLD = { top: 'v', left: 'u', right: 't' };

/** Draws a parts list; shared outline logic lives in boxes(). */
export function render(w, h, ox, oy, parts) {
  return boxes(w, h, ox, oy, parts);
}

/** Pixels of `next` that differ from `base` (as a new grid; everything else transparent). */
export function diff(base, next) {
  const g = new Grid(next.w, next.h);
  for (let y = 0; y < next.h; y++)
    for (let x = 0; x < next.w; x++) {
      const c = next.get(x, y);
      if (c !== '.' && c !== base.get(x, y)) g.set(x, y, c);
    }
  return g;
}
