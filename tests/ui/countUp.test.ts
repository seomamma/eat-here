import { describe, expect, it } from 'vitest';
import { countUpValue } from '../../src/ui/components/MoneyAmount';

describe('money count-up', () => {
  it('starts at the old value and ends at the new one', () => {
    expect(countUpValue(100, 130, 0)).toBe(100);
    expect(countUpValue(100, 130, 10_000)).toBe(130);
  });

  it('only ever moves towards the target, in order', () => {
    let prev = 100;
    for (let t = 0; t <= 450; t += 30) {
      const v = countUpValue(100, 130, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(130);
      prev = v;
    }
  });
});
