import { describe, expect, it } from 'vitest';
import { placeControls } from '../../src/ui/components/BuildControls';

const size = { w: 250, h: 90 };
const view = { w: 390, h: 844 };

describe('placeControls', () => {
  it('sits centred just above the item', () => {
    const p = placeControls({ left: 150, top: 400, right: 240, bottom: 460 }, size, view, 80, 836);
    expect(p).toEqual({ left: 70, top: 300 });
  });

  it('is clamped to the screen sides', () => {
    expect(
      placeControls({ left: 0, top: 400, right: 30, bottom: 460 }, size, view, 80, 836).left,
    ).toBe(8);
    expect(
      placeControls({ left: 360, top: 400, right: 390, bottom: 460 }, size, view, 80, 836).left,
    ).toBe(390 - 8 - 250);
  });

  it('flips below the item when there is no room above', () => {
    const p = placeControls({ left: 150, top: 100, right: 240, bottom: 160 }, size, view, 80, 836);
    expect(p.top).toBe(170);
  });

  it('never leaves the allowed vertical band', () => {
    const p = placeControls({ left: 150, top: 700, right: 240, bottom: 830 }, size, view, 80, 836);
    expect(p.top).toBeGreaterThanOrEqual(80);
    expect(p.top + size.h).toBeLessThanOrEqual(836);
  });
});
