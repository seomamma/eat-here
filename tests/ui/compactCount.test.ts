import { describe, expect, it } from 'vitest';
import { STRINGS, compactCount } from '../../src/data/strings';

describe('compactCount', () => {
  it('keeps small numbers and shortens thousands', () => {
    expect(compactCount(500)).toBe('500');
    expect(compactCount(4300)).toBe('4.3k');
    expect(compactCount(10500)).toBe('10.5k');
    expect(compactCount(28000)).toBe('28k');
    expect(STRINGS.fame.progress(4300, 10500)).toBe('4.3k / 10.5k');
  });
});
