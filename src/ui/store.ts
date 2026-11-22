import { signal } from '@preact/signals';
import type { DayStats } from '../sim/dayStats';
import type { Command, CommandResult, Game } from '../sim/game';
import type { DayPhase } from '../sim/time';

/** UI-facing mirror of sim state. Written only from sim events; the UI never mutates the sim. */
export const money = signal(0);
export const day = signal(1);
export const minuteOfDay = signal(0);
export const phase = signal<DayPhase>('prep');
/** Stats of the day that just ended; set while the report modal is shown. */
export const report = signal<{ day: number; stats: DayStats } | null>(null);

let sink: ((cmd: Command) => CommandResult) | null = null;

/** The UI's only way to act on the game: send a command. */
export function dispatch(cmd: Command): CommandResult {
  return sink ? sink(cmd) : { ok: false, reason: 'not_bound' };
}

/** Seeds the signals from the current state and keeps them in sync via sim events. */
export function bindStore(sim: Game): void {
  sink = (cmd) => sim.dispatch(cmd);
  const { clock } = sim.state;
  money.value = sim.state.money;
  day.value = clock.day;
  minuteOfDay.value = clock.minuteOfDay;
  phase.value = clock.phase;
  report.value = clock.phase === 'report' ? { day: clock.day, stats: sim.state.dayStats } : null;
  sim.events.on('moneyChanged', (e) => {
    money.value = e.money;
  });
  sim.events.on('clockChanged', (e) => {
    day.value = e.day;
    minuteOfDay.value = e.minuteOfDay;
    phase.value = e.phase;
  });
  sim.events.on('phaseChanged', (e) => {
    if (e.phase !== 'report') report.value = null;
  });
  sim.events.on('dayEnded', (e) => {
    report.value = { day: e.day, stats: e.stats };
  });
}
