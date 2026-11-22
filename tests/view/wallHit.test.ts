import { describe, expect, it } from 'vitest';
import { START_ROOM } from '../../src/data/layout';
import { roomAtRank } from '../../src/data/expansion';
import { tileToScreen } from '../../src/view/iso';
import { wallQuad, wallSegmentAt } from '../../src/view/wallHit';

const room = START_ROOM;
const { x0, y0, x1, y1 } = room;

describe('wallSegmentAt', () => {
  it('finds the segment under the centre of every wall face quad', () => {
    for (const id of [`l${y0}`, `l${y0 + 4}`, `l${y1}`, `r${x0}`, `r${x0 + 3}`, `r${x1}`]) {
      const q = wallQuad(id, room);
      const cx = (q[0]!.x + q[1]!.x) / 2;
      const cy = (q[0]!.y + q[1]!.y + q[2]!.y + q[3]!.y) / 4;
      expect(wallSegmentAt(cx, cy, room), id).toBe(id);
    }
  });

  it('misses above the wall, below it and beyond the ends', () => {
    const id = `r${x0 + 3}`;
    const q = wallQuad(id, room);
    const cx = (q[0]!.x + q[1]!.x) / 2;
    expect(wallSegmentAt(cx, q[0]!.y - 12, room)).toBeNull();
    expect(wallSegmentAt(cx, q[2]!.y + 12, room)).toBeNull();
    // The segment past the last column / row does not exist in the starting room.
    const beyondR = wallQuad(`r${x1 + 1}`, room);
    expect(wallSegmentAt(beyondR[0]!.x + 8, beyondR[0]!.y + 20, room)).toBeNull();
    const beyondL = wallQuad(`l${y1 + 1}`, room);
    expect(wallSegmentAt(beyondL[0]!.x + 8, beyondL[0]!.y + 20, room)).toBeNull();
  });

  it('follows the walls when the room has grown towards -x and -y', () => {
    const grown = roomAtRank(5);
    // A segment of the new back-right wall (above the old y0 edge) is hit; ids stay absolute.
    const id = `r${grown.x0 + 1}`;
    const q = wallQuad(id, grown);
    const cx = (q[0]!.x + q[1]!.x) / 2;
    const cy = (q[0]!.y + q[2]!.y) / 2;
    expect(wallSegmentAt(cx, cy, grown)).toBe(id);
    // An old segment keeps its id; its screen position follows the new wall tile row.
    const old = `r${x0 + 3}`;
    const oq = wallQuad(old, grown);
    const o = tileToScreen(x0 + 3, grown.y0 - 1);
    expect(oq[0]!.x).toBe(o.x - 16);
    expect(wallSegmentAt((oq[0]!.x + oq[1]!.x) / 2, (oq[0]!.y + oq[2]!.y) / 2, grown)).toBe(old);
  });
});
