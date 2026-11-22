import { signal } from '@preact/signals';
import type { Game } from '../sim/game';

/** UI-facing mirror of sim state. Written only from sim events; the UI never mutates the sim. */
export const money = signal(0);
export const day = signal(1);

/** Seeds the signals from the current state and keeps them in sync via sim events. */
export function bindStore(sim: Game): void {
  money.value = sim.state.money;
  day.value = sim.state.day;
  sim.events.on('moneyChanged', (e) => {
    money.value = e.money;
  });
}
