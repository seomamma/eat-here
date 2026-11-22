import { describe, expect, it } from 'vitest';
import { wallQuad, wallSegmentAt } from '../../src/view/wallHit';

const grid = { width: 10, height: 12 };

describe('wallSegmentAt', () => {
  it('finds the segment under the centre of every wall face quad', () => {
    for (const id of ['l1', 'l5', 'l11', 'r1', 'r4', 'r8']) {
      const q = wallQuad(id);
      const cx = (q[0]!.x + q[1]!.x) / 2;
      const cy = (q[0]!.y + q[1]!.y + q[2]!.y + q[3]!.y) / 4;
      expect(wallSegmentAt(cx, cy, grid), id).toBe(id);
    }
  });

  it('misses above the wall, below it and beyond the ends', () => {
    const q = wallQuad('r4');
    const cx = (q[0]!.x + q[1]!.x) / 2;
    expect(wallSegmentAt(cx, q[0]!.y - 12, grid)).toBeNull();
    expect(wallSegmentAt(cx, q[2]!.y + 12, grid)).toBeNull();
    expect(wallSegmentAt(16 * 9, 80, grid)).toBeNull(); // r10 does not exist
    expect(wallSegmentAt(-16 * 12, 80, grid)).toBeNull(); // l13 does not exist
  });
});
