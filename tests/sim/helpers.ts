import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { minuteAtTick } from '../../src/sim/time';

/** Tick of 12:30 in the open day (lunch peak). */
const LUNCH_TICK = Math.round((12.5 * 60 - minuteAtTick(0)) / (minuteAtTick(1) - minuteAtTick(0)));

/**
 * A restaurant that is open with the clock held at the lunch peak, so long-running tests are not
 * cut short by closing time. Guests keep arriving until a test sets `guestSpawn.enabled = false`.
 */
export function openGame(seed?: number): Game {
  const g = new Game(createInitialState(seed));
  g.dispatch({ type: 'openRestaurant' });
  const tick = g.tickOnce.bind(g);
  g.tickOnce = () => {
    g.state.clock.dayTick = LUNCH_TICK;
    tick();
  };
  return g;
}
