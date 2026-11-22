import { describe, expect, it } from 'vitest';
import {
  depthKey,
  gridBounds,
  screenToTile,
  tileRectBounds,
  tileToScreen,
} from '../../src/view/iso';

const W = 10;
const H = 12;

describe('tileToScreen', () => {
  it('projects the diamond top corner', () => {
    expect(tileToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileToScreen(1, 0)).toEqual({ x: 16, y: 8 });
    expect(tileToScreen(0, 1)).toEqual({ x: -16, y: 8 });
    expect(tileToScreen(3, 5)).toEqual({ x: -32, y: 64 });
  });
});

describe('screenToTile', () => {
  it('round-trips the centre of every tile of a 10x12 grid', () => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = tileToScreen(x, y);
        expect(screenToTile(o.x, o.y + 8)).toEqual({ x, y });
        expect(screenToTile(o.x, o.y)).toEqual({ x, y }); // top corner
      }
    }
  });

  it('hits the right tile just inside each of the four edges', () => {
    const e = 0.01;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = tileToScreen(x, y);
        // Midpoints of the four edges, nudged towards the centre (o.x, o.y + 8).
        const mids = [
          { x: o.x + 8, y: o.y + 4 }, // top-right edge
          { x: o.x + 8, y: o.y + 12 }, // bottom-right edge
          { x: o.x - 8, y: o.y + 12 }, // bottom-left edge
          { x: o.x - 8, y: o.y + 4 }, // top-left edge
        ];
        for (const m of mids) {
          const nx = m.x + Math.sign(o.x - m.x) * e;
          const ny = m.y + Math.sign(o.y + 8 - m.y) * e * 0.5;
          expect(screenToTile(nx, ny)).toEqual({ x, y });
        }
        // Left and right corners, nudged inwards.
        expect(screenToTile(o.x - 16 + 0.1, o.y + 8)).toEqual({ x, y });
        expect(screenToTile(o.x + 16 - 0.1, o.y + 8)).toEqual({ x, y });
        // Bottom corner, nudged inwards.
        expect(screenToTile(o.x, o.y + 16 - 0.1)).toEqual({ x, y });
      }
    }
  });

  it('assigns points just outside an edge to the neighbouring tile', () => {
    const o = tileToScreen(4, 4); // (0, 64)
    expect(screenToTile(o.x + 8 + 0.2, o.y + 4 - 0.2)).toEqual({ x: 4, y: 3 }); // beyond top-right
    expect(screenToTile(o.x - 8 - 0.2, o.y + 4 - 0.2)).toEqual({ x: 3, y: 4 }); // beyond top-left
    expect(screenToTile(o.x + 8 + 0.2, o.y + 12 + 0.2)).toEqual({ x: 5, y: 4 }); // bottom-right
    expect(screenToTile(o.x - 8 - 0.2, o.y + 12 + 0.2)).toEqual({ x: 4, y: 5 }); // bottom-left
  });

  it('every pixel centre of a tile diamond maps back to that tile', () => {
    // Sampled the same way the placeholder art is rasterised (32x16 diamond).
    for (const [x, y] of [
      [0, 0],
      [3, 7],
      [9, 11],
    ] as const) {
      const o = tileToScreen(x, y);
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 32; px++) {
          const sx = o.x - 16 + px + 0.5;
          const sy = o.y + py + 0.5;
          const inside = Math.abs(sx - o.x) / 16 + Math.abs(sy - o.y - 8) / 8 < 1;
          const t = screenToTile(sx, sy);
          if (inside) expect(t).toEqual({ x, y });
          else expect(t).not.toEqual({ x, y });
        }
      }
    }
  });

  it('gives tiles outside the grid out-of-range coordinates', () => {
    expect(screenToTile(0, -20).y).toBeLessThan(0);
    expect(screenToTile(0, -20).x).toBeLessThan(0);
  });
});

describe('depthKey', () => {
  it('orders by x + y', () => {
    expect(depthKey(2, 3)).toBeLessThan(depthKey(3, 3));
    expect(depthKey(5, 0)).toBeLessThan(depthKey(2, 4));
    expect(depthKey(0, 0)).toBeLessThan(depthKey(0, 1));
  });

  it('breaks ties on x', () => {
    expect(depthKey(2, 4)).toBeLessThan(depthKey(3, 3));
    expect(depthKey(3, 3)).toBeLessThan(depthKey(4, 2));
  });

  it('keeps the tie-break below one depth step for the whole grid', () => {
    for (let x = 0; x < 64; x++) expect(depthKey(x, 0)).toBeLessThan(depthKey(0, x + 1));
  });

  it('works for fractional (walking) positions', () => {
    expect(depthKey(2.5, 3)).toBeGreaterThan(depthKey(2, 3));
    expect(depthKey(2.5, 3)).toBeLessThan(depthKey(3, 3));
  });
});

describe('bounds', () => {
  it('computes the diamond bounding box of the grid', () => {
    expect(gridBounds(W, H)).toEqual({ minX: -192, maxX: 160, minY: 0, maxY: 176 });
  });

  it('contains every tile corner', () => {
    const b = gridBounds(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = tileToScreen(x, y);
        expect(o.x - 16).toBeGreaterThanOrEqual(b.minX);
        expect(o.x + 16).toBeLessThanOrEqual(b.maxX);
        expect(o.y).toBeGreaterThanOrEqual(b.minY);
        expect(o.y + 16).toBeLessThanOrEqual(b.maxY);
      }
    }
  });

  it('computes bounds of a sub-rectangle (the interior floor)', () => {
    expect(tileRectBounds(1, 1, 9, 12)).toEqual({ minX: -176, maxX: 128, minY: 16, maxY: 168 });
  });
});
