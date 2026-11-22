import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/sim/state';

describe('createInitialState', () => {
  it('starts at version 1, day 1 with 300 money', () => {
    const s = createInitialState();
    expect(s).toMatchObject({ version: 1, money: 300 });
    expect(s.clock).toMatchObject({ day: 1, phase: 'open', minuteOfDay: 600 });
  });

  it('returns a fresh object each call', () => {
    expect(createInitialState()).not.toBe(createInitialState());
  });

  it('is serializable', () => {
    const s = createInitialState();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
