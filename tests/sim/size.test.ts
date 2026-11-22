import { expect, it } from 'vitest';
import { Game } from '../../src/sim/game';
import { serialize } from '../../src/sim/save';
import { createInitialState } from '../../src/sim/state';

it('a save does not grow with the number of days played (10 simulated days)', () => {
  const g = new Game(createInitialState(9));
  const atDayStart: number[] = [];
  let peak = 0;
  let day = 1;
  for (let i = 0; i < 400_000 && g.state.clock.day <= 10; i++) {
    if (g.state.clock.phase === 'report') g.dispatch({ type: 'continueAfterReport' });
    g.tickOnce();
    if (i % 50 === 0) peak = Math.max(peak, serialize(g.state, 0).length);
    if (g.state.clock.day !== day) {
      day = g.state.clock.day;
      atDayStart.push(serialize(g.state, 0).length);
    }
  }
  expect(g.state.clock.day).toBeGreaterThan(10);
  // Measured: about 3.5 KB at every day start, about 8 KB at the busiest moment.
  expect(peak).toBeLessThan(16_000);
  expect(Math.max(...atDayStart) - Math.min(...atDayStart)).toBeLessThan(200);
});
