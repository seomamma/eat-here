import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../../src/sim/events';

describe('Emitter', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const e = new Emitter<{ hi: { n: number } }>();
    const fn = vi.fn();
    const off = e.on('hi', fn);
    e.emit('hi', { n: 1 });
    off();
    e.emit('hi', { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ n: 1 });
  });
});
