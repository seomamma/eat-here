// Seating and kitchen pieces with level overlays (M13b): the five M13 / M12c pieces redrawn as
// tiered functions (same geometry as world.mjs / m12c.mjs) plus the cushioned chair and long table.
import { boxes, part, legs, plot, hash, GOLD, blobs, proj } from './iso.mjs';
import { glint } from './m13b-lib.mjs';

const WOOD = { top: 'd', left: 'c', right: 'b' };

/** Chair body shared by the wooden, cushioned and high chairs. */
function chairParts({ back, tier, frame, ox, oy, cushion, high }) {
  const seatTone = cushion ? { top: 'n', left: 'm', right: 'l' } : high ? { top: 'v', left: 'u', right: 't' } : WOOD;
  const goldRail = tier >= 1;
  const bz1 = high ? 22 : 19;
  const parts = [
    ...legs(high ? 0.22 : 0.2, high ? 0.22 : 0.2, high ? 0.78 : 0.8, high ? 0.78 : 0.8, high ? 8 : 5, 0.12),
    part({
      i0: high ? 0.2 : 0.16, j0: high ? 0.2 : 0.16, i1: high ? 0.8 : 0.84, j1: high ? 0.8 : 0.84,
      z0: high ? 8 : 5, z1: high ? 11 : 8,
      ...(high ? seatTone : cushion ? { top: 'd', left: 'c', right: 'b' } : WOOD),
      decal: (face, a, e) =>
        face === 'top' && !high && !cushion ? (hash(Math.floor(a * 10), Math.floor(e * 10), 4) < 90 ? 'c' : undefined) : undefined,
    }),
  ];
  if (cushion)
    parts.push(
      part({
        i0: 0.2, j0: 0.2, i1: 0.8, j1: 0.8, z0: 8, z1: 11, ...seatTone,
        decal: (face, a, e) => (face === 'top' && Math.abs(a - 0.5) < 0.05 && Math.abs(e - 0.5) < 0.05 ? 'l' : undefined),
      }),
    );
  // Backrest
  const j0 = back ? (high ? 0.68 : 0.7) : high ? 0.2 : 0.16;
  const j1 = back ? (high ? 0.8 : 0.84) : high ? 0.32 : 0.3;
  parts.push(
    part({
      i0: high ? 0.2 : 0.16, j0, i1: high ? 0.8 : 0.84, j1,
      z0: high ? 11 : 8, z1: bz1,
      ...(high ? { top: 'v', left: 'u', right: 't' } : WOOD),
      decal: (face, a, e) => {
        if (face === 'top') return goldRail ? 'v' : undefined;
        if (cushion) {
          // padded panel inside a wood frame
          if (a > 2 && a < 8.5 && e > 2.5 && e < 9.5) return face === 'left' ? 'n' : 'm';
          if (e >= 9.5 && goldRail) return face === 'left' ? 'u' : 't';
          return undefined;
        }
        if (high) return e > 9 && goldRail ? (face === 'left' ? 'v' : 'u') : undefined;
        if (goldRail && e > 7.2) return face === 'left' ? 'u' : 't';
        return e > 4 && e < 6 ? 'b' : undefined;
      },
    }),
  );
  if (high) {
    parts.push(
      part({
        i0: 0.16, j0: back ? 0.1 : 0.6, i1: 0.84, j1: back ? 0.4 : 0.9, z0: 13, z1: 14,
        ...(goldRail ? GOLD : WOOD),
      }),
    );
  }
  if (tier >= 2)
    parts.push(
      plot((g) => {
        // A golden finial on top of the backrest.
        const s = proj(0.5, back ? 0.77 : high ? 0.26 : 0.23, bz1);
        const x = ox + Math.round(s.x);
        const y = oy + Math.round(s.y);
        g.rect(x - 1, y - 2, x, y - 1, 'v');
        g.set(x - 1, y - 3, 'W');
        g.set(x, y - 3, 'v');
        g.set(x - 2, y - 2, 'k');
        glint(g, ox - 10, oy - 4, frame === 0);
        glint(g, ox + 10, oy - 9, frame === 1);
      }, [1, 1, 99]),
    );
  return parts;
}

const chairPiece = (id, o) => ({
  id,
  w: 1,
  h: 1,
  origin: [16, 19],
  draw(view, tier, frame) {
    return boxes(1, 1, 16, 19, chairParts({ back: view === 'back', tier, frame, ox: 16, oy: 19, ...o }));
  },
});
export const chairWood = chairPiece('chair_wood', {});
export const chairCushion = chairPiece('chair_cushion', { cushion: true });
export const chairHigh = chairPiece('chair_high', { high: true });

// ---- tables ---------------------------------------------------------------------------------
function tableParts({ long, tier, frame, ox, oy }) {
  const W = long ? 2 : 1;
  const gold = tier >= 1;
  const parts = [
    ...legs(0.12, 0.12, W - 0.12, 0.88, 9),
    part({
      i0: 0.06, j0: 0.06, i1: W - 0.06, j1: 0.94, z0: 9, z1: 12,
      top: 'm', left: gold ? 'u' : 'l', right: gold ? 't' : 'e',
      decal: (face, a, e) => {
        if (face === 'top') {
          const cx = long ? [0.5, 1.5] : [0.5];
          for (const c of cx) {
            const di = Math.abs(a - c);
            const dj = Math.abs(e - 0.5);
            if (di < 0.17 && dj < 0.17) return di < 0.12 && dj < 0.12 ? 'h' : 'i';
          }
          if (a < 0.1 || e < 0.1) return gold ? 'v' : 'n';
          if (gold && (a > W - 0.1 || e > 0.9)) return 'u';
          return undefined;
        }
        if (e < 1) return gold ? 't' : 'a';
        return gold && e < 2 ? (face === 'left' ? 'u' : 't') : face === 'left' ? 'l' : 'e';
      },
    }),
  ];
  if (tier >= 2)
    parts.push(
      plot((g) => {
        const spots = long ? [0.5, 1.5] : [0.5];
        for (const i of spots) {
          const s = proj(i, 0.5, 12);
          const x = ox + Math.round(s.x);
          const y = oy + Math.round(s.y);
          g.rect(x - 1, y - 4, x, y, 'h');
          g.set(x, y - 4, 'i');
          g.rect(x - 1, y - 5, x, y - 5, 'k');
          g.set(x - 1, y - 6 - frame, 'u');
          g.set(x - 1, y - 7 - frame, 'v');
          g.set(x, y - 6 - frame, 'v');
        }
        glint(g, ox - 12, oy - 6, frame === 0);
        glint(g, ox + (long ? 20 : 12), oy - 8, frame === 1);
      }, [W, 1, 99]),
    );
  return parts;
}
export const tableSmall = {
  id: 'table_small',
  w: 1,
  h: 1,
  origin: [16, 15],
  draw: (view, tier, frame) => boxes(1, 1, 16, 15, tableParts({ long: false, tier, frame, ox: 16, oy: 15 })),
};
export const tableLong = {
  id: 'table_long',
  w: 2,
  h: 1,
  origin: [16, 15],
  draw: (view, tier, frame) => boxes(2, 1, 16, 15, tableParts({ long: true, tier, frame, ox: 16, oy: 15 })),
};

// ---- pass counter ---------------------------------------------------------------------------
export const pass = {
  id: 'counter_pass',
  w: 2,
  h: 1,
  origin: [16, 15],
  draw(view, tier, frame) {
    const back = view === 'back';
    const gold = tier >= 1;
    const [ox, oy] = this.origin;
    const parts = [
      part({
        i0: 0, j0: 0.1, i1: 2, j1: 0.9, z0: 0, z1: 11,
        top: 'h', left: 'c', right: 'b',
        decal: (face, a, e) => {
          if (face === 'top') return gold && (e < 0.16 || e > 0.84) ? 'u' : undefined;
          if (!back && face === 'left') {
            if (e < 1.5) return gold ? 't' : 'a';
            if (e > 2.5 && e < 9.5 && a % 16 > 2 && a % 16 < 14) return e > 8.5 || a % 16 < 3.5 ? 'd' : 'b';
            if (e > 4.5 && e < 6 && a % 16 > 11 && a % 16 < 13) return 'u';
            if (gold && e >= 10) return 'u';
            return undefined;
          }
          if (back && face === 'left' && e > 6 && e < 8) return 'b';
          if (gold && e >= 10) return face === 'left' ? 'u' : 't';
          return undefined;
        },
      }),
      part({
        i0: back ? 1.1 : 0.15, j0: back ? 0.65 : 0.12, i1: back ? 1.9 : 0.95, j1: back ? 0.8 : 0.26,
        z0: 11, z1: 13, top: gold ? 'v' : 'x', left: gold ? 'u' : 'w', right: gold ? 't' : 'w',
      }),
      part({
        i0: back ? 1.25 : 0.4, j0: back ? 0.66 : 0.13, i1: back ? 1.4 : 0.55, j1: back ? 0.7 : 0.17,
        z0: 13, z1: 16, top: 'h', left: 'h', right: 'i',
      }),
      part({
        i0: back ? 0.35 : 1.2, j0: 0.3, i1: back ? 0.85 : 1.7, j1: 0.7, z0: 11, z1: 12,
        top: 'v', left: 'u', right: 't',
      }),
    ];
    if (tier >= 2) {
      parts.push(
        blobs({
          ox, oy, sort: [1.4, 0.5, 12], levels: [0.1, 0.35, 0.6],
          clusters: [{ ci: back ? 0.6 : 1.45, cj: 0.5, cz: 12, ri: 0.14, rj: 0.14, rz: 5, zmin: 12, ramp: ['t', 'u', 'v', 'W'] }],
        }),
        plot((g) => {
          glint(g, ox + (back ? 4 : 20), oy - 6, frame === 0);
          glint(g, ox + 28, oy + 2, frame === 1);
        }, [2, 1, 99]),
      );
    }
    return boxes(2, 1, ox, oy, parts);
  },
};

export const SEATING = [chairWood, chairCushion, chairHigh, tableSmall, tableLong, pass];
