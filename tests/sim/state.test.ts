import { SAVE_VERSION } from '../../src/sim/save';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/sim/state';

describe('createInitialState', () => {
  it('starts at the current save version, day 1 with 300 money', () => {
    const s = createInitialState();
    expect(s).toMatchObject({ version: SAVE_VERSION, money: 300 });
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
