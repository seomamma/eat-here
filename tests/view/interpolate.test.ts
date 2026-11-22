import { describe, expect, it } from 'vitest';
import { interpolatePosition } from '../../src/view/interpolate';

describe('interpolatePosition', () => {
  const c = { prevX: 2, prevY: 3, x: 3, y: 3 };
  it('blends between the previous and current position', () => {
    expect(interpolatePosition(c, 0)).toEqual({ x: 2, y: 3 });
    expect(interpolatePosition(c, 0.5)).toEqual({ x: 2.5, y: 3 });
    expect(interpolatePosition(c, 1)).toEqual({ x: 3, y: 3 });
  });
  it('clamps alpha', () => {
    expect(interpolatePosition(c, -1).x).toBe(2);
    expect(interpolatePosition(c, 2).x).toBe(3);
  });
});
