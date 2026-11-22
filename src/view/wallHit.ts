import type { WallSegmentId } from '../data/surfaces';

/** Back-wall segments are 16 px wide strips; these match the images WorldRenderer places. */
const SEG_W = 16;
/** Vertical extent of a wall face below its top contour (px). */
const WALL_FACE_H = 41;
/** Image top of a segment relative to 8 * index (see WorldRenderer.wall). */
const IMG_TOP = -33;

interface Strip {
  /** Left edge and top of the segment image in world px. */
  ix: number;
  iy: number;
  side: 'l' | 'r';
}

function stripOf(id: WallSegmentId): Strip | null {
  const n = Number(id.slice(1));
  if (!Number.isInteger(n)) return null;
  if (id.startsWith('l')) return { ix: -SEG_W * n, iy: 8 * n + IMG_TOP, side: 'l' };
  if (id.startsWith('r')) return { ix: SEG_W * n - SEG_W, iy: 8 * n + IMG_TOP, side: 'r' };
  return null;
}

/** Top contour row of the segment at pixel column tx (rises to the right on the left wall). */
function topAt(side: 'l' | 'r', tx: number): number {
  return side === 'r' ? Math.floor(tx / 2) : Math.floor((SEG_W - 1 - tx) / 2);
}

/** Corner points of the wall face of a segment (for the paint preview). */
export function wallQuad(id: WallSegmentId): { x: number; y: number }[] {
  const s = stripOf(id);
  if (!s) return [];
  const a = topAt(s.side, 0);
  const b = topAt(s.side, SEG_W - 1);
  return [
    { x: s.ix, y: s.iy + a },
    { x: s.ix + SEG_W, y: s.iy + b },
    { x: s.ix + SEG_W, y: s.iy + b + WALL_FACE_H },
    { x: s.ix, y: s.iy + a + WALL_FACE_H },
  ];
}

/** The back-wall segment under a world point, or null. `width`/`height` = grid size. */
export function wallSegmentAt(
  wx: number,
  wy: number,
  grid: { width: number; height: number },
): WallSegmentId | null {
  const side = wx < 0 ? 'l' : 'r';
  const n = side === 'l' ? Math.ceil(-wx / SEG_W) : Math.floor(wx / SEG_W) + 1;
  if (side === 'l' ? n < 1 || n > grid.height - 1 : n < 1 || n > grid.width - 2) return null;
  const id = `${side}${n}`;
  const s = stripOf(id);
  if (!s) return null;
  const tx = Math.min(SEG_W - 1, Math.max(0, Math.floor(wx - s.ix)));
  const top = s.iy + topAt(side, tx);
  return wy >= top && wy <= top + WALL_FACE_H ? id : null;
}
