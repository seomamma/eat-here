import { signal } from '@preact/signals';
import type { DayStats } from '../sim/dayStats';
import type { Command, CommandResult, Game } from '../sim/game';
import type { DayPhase } from '../sim/time';
import type { GuestPhase } from '../sim/characters';
import { isGuest } from '../sim/characters';
import type { HappinessEntry } from '../sim/systems/happiness';
import { selectGuest, selectedGuestId } from './selection';

/** UI-facing mirror of sim state. Written only from sim events; the UI never mutates the sim. */
export const money = signal(0);
export const day = signal(1);
export const minuteOfDay = signal(0);
export const phase = signal<DayPhase>('prep');
/** Stats of the day that just ended; set while the report modal is shown. */
export const report = signal<{ day: number; stats: DayStats } | null>(null);

export const fame = signal(0);
export const rank = signal(1);

export interface RankUpInfo {
  rank: number;
  name: string;
  unlocks: string[];
}
/** Rank-ups waiting to be shown (the first one is on screen); the sim is paused while any is. */
export const rankUps = signal<RankUpInfo[]>([]);

/** Snapshot of the selected guest for the info card. */
export interface GuestCardInfo {
  id: string;
  name: string;
  happiness: number;
  log: HappinessEntry[];
  phase: GuestPhase;
}
export const guestCard = signal<GuestCardInfo | null>(null);

const RANK_UP_PAUSE = 'rankUp';
/** How often the open info card re-reads its guest (ms). */
const GUEST_CARD_REFRESH_MS = 150;
let simRef: Game | null = null;

let sink: ((cmd: Command) => CommandResult) | null = null;

/** The UI's only way to act on the game: send a command. */
export function dispatch(cmd: Command): CommandResult {
  return sink ? sink(cmd) : { ok: false, reason: 'not_bound' };
}

/** Seeds the signals from the current state and keeps them in sync via sim events. */
export function bindStore(sim: Game): void {
  sink = (cmd) => sim.dispatch(cmd);
  simRef = sim;
  const { clock } = sim.state;
  money.value = sim.state.money;
  fame.value = sim.state.fame;
  rank.value = sim.state.rank;
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
  sim.events.on('fameChanged', (e) => {
    fame.value = e.fame;
    rank.value = e.rank;
  });
  sim.events.on('rankUp', (e) => {
    rankUps.value = [...rankUps.value, { rank: e.rank, name: e.name, unlocks: e.unlocks }];
    sim.pause(RANK_UP_PAUSE);
  });
  sim.events.on('guestLeft', (e) => {
    if (selectedGuestId.value === e.guestId) selectGuest(null);
  });
  selectedGuestId.subscribe(() => refreshGuestCard(sim));
  setInterval(() => refreshGuestCard(sim), GUEST_CARD_REFRESH_MS);
}

/** Closes the RANK UP modal; the sim resumes once the last one is dismissed. */
export function dismissRankUp(): void {
  rankUps.value = rankUps.value.slice(1);
  if (rankUps.value.length === 0) simRef?.resume(RANK_UP_PAUSE);
}

function refreshGuestCard(sim: Game): void {
  const id = selectedGuestId.value;
  const guest = id ? sim.state.characters.find((c) => c.id === id) : undefined;
  if (!guest || !isGuest(guest)) {
    guestCard.value = null;
    return;
  }
  const next: GuestCardInfo = {
    id: guest.id,
    name: guest.name,
    happiness: guest.happiness,
    log: guest.happinessLog.map((e) => ({ ...e })),
    phase: guest.phase,
  };
  if (JSON.stringify(next) !== JSON.stringify(guestCard.peek())) guestCard.value = next;
}
