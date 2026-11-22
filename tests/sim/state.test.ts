import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/sim/state';

describe('createInitialState', () => {
  it('starts at version 1, day 1 with 300 money', () => {
    expect(createInitialState()).toEqual({ version: 1, money: 300, day: 1 });
  });

  it('returns a fresh object each call', () => {
    expect(createInitialState()).not.toBe(createInitialState());
  });

  it('is serializable', () => {
    const s = createInitialState();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
