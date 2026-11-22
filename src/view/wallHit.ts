import type { Room } from '../data/layout';
import type { WallSegmentId } from '../data/surfaces';
import { tileToScreen } from './iso';

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

/**
 * Image position of a segment. `l<n>` is the back-left wall beside row n, standing on the wall
 * tile (x0 - 1, n); `r<n>` the back-right wall beside column n, on the wall tile (n, y0 - 1).
 */
function stripOf(id: WallSegmentId, room: Readonly<Room>): Strip | null {
  const n = Number(id.slice(1));
  if (!Number.isInteger(n)) return null;
  if (id.startsWith('l')) {
    const o = tileToScreen(room.x0 - 1, n);
    return { ix: o.x, iy: o.y + IMG_TOP, side: 'l' };
  }
  if (id.startsWith('r')) {
    const o = tileToScreen(n, room.y0 - 1);
    return { ix: o.x - SEG_W, iy: o.y + IMG_TOP, side: 'r' };
  }
  return null;
}

/** Top contour row of the segment at pixel column tx (rises to the right on the left wall). */
function topAt(side: 'l' | 'r', tx: number): number {
  return side === 'r' ? Math.floor(tx / 2) : Math.floor((SEG_W - 1 - tx) / 2);
}

/** Corner points of the wall face of a segment (for the paint preview). */
export function wallQuad(id: WallSegmentId, room: Readonly<Room>): { x: number; y: number }[] {
  const s = stripOf(id, room);
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

/**
 * The back-wall segment under a world point, or null. Left-wall strips sit left of the wall
 * tile column's screen x, right-wall strips to its right; the room says which ids exist.
 */
export function wallSegmentAt(wx: number, wy: number, room: Readonly<Room>): WallSegmentId | null {
  // Candidate strips: the left wall column is the one whose image spans wx, same for the right.
  const cands: WallSegmentId[] = [];
  for (let y = room.y0; y <= room.y1; y++) cands.push(`l${y}`);
  for (let x = room.x0; x <= room.x1; x++) cands.push(`r${x}`);
  for (const id of cands) {
    const s = stripOf(id, room);
    if (!s || wx < s.ix || wx >= s.ix + SEG_W) continue;
    const tx = Math.min(SEG_W - 1, Math.max(0, Math.floor(wx - s.ix)));
    const top = s.iy + topAt(s.side, tx);
    if (wy >= top && wy <= top + WALL_FACE_H) return id;
  }
  return null;
}
