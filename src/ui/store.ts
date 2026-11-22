import { signal } from '@preact/signals';
import type { IngredientId } from '../data/ingredients';
import type { RecipeId } from '../data/recipes';
import type { DayStats, LedgerEntry } from '../sim/dayStats';
import type { GameState } from '../sim/state';
import type { MarketState } from '../sim/systems/market';
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
export const phase = signal<DayPhase>('open');
/** Today's money ledger (copy of `dayStats.ledger.entries`; refreshed whenever money changes). */
export const ledger = signal<LedgerEntry[]>([]);
/** Stats of the day that just ended; set while the report modal is shown. */
export const report = signal<{ day: number; stats: DayStats } | null>(null);

export const fame = signal(0);
export const rank = signal(1);

export interface RankUpInfo {
  rank: number;
  name: string;
  unlocks: string[];
  reward: IngredientId | null;
}
/** Rank-ups waiting to be shown (the first one is on screen); the sim is paused while any is. */
export const rankUps = signal<RankUpInfo[]>([]);

/** Copies of sim state the panels render (refreshed from sim events; read-only for the UI). */
export const inventory = signal<Record<IngredientId, number>>({} as Record<IngredientId, number>);
export const market = signal<MarketState>({ day: 1, offers: [] });
export const recipeStates = signal<GameState['recipes']>({} as GameState['recipes']);

export type Toast =
  | { id: number; kind: 'level'; recipeId: RecipeId; level: number }
  | { id: number; kind: 'gift'; guestName: string; ingredient: IngredientId }
  | { id: number; kind: 'notice'; text: string };
/** Transient feedback cards (level up, gifts); they dismiss themselves and never pause the sim. */
export const toasts = signal<Toast[]>([]);
const TOAST_MS = 4000;
let nextToastId = 1;

type NewToast = Toast extends infer T ? (T extends Toast ? Omit<T, 'id'> : never) : never;

export function pushToast(toast: NewToast): void {
  const id = nextToastId++;
  toasts.value = [...toasts.value, { ...toast, id } as Toast];
  setTimeout(() => dismissToast(id), TOAST_MS);
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/** Which full-screen view is up: the title menu (no sim running) or the game. */
export const screen = signal<'title' | 'game'>('title');

/** What the title screen shows and does; filled in by main before the first render. */
export interface TitleMenu {
  /** Null when there is no valid save. */
  save: { day: number; rankName: string; money: number } | null;
  onContinue: () => void;
  onNewGame: () => void;
}
export const titleMenu = signal<TitleMenu | null>(null);

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
  const syncLedger = () => {
    ledger.value = sim.state.dayStats.ledger.entries.map((e) => ({ ...e }));
  };
  syncLedger();
  sim.events.on('dayStarted', syncLedger);
  const syncPantry = () => {
    inventory.value = { ...sim.state.inventory };
    market.value = structuredClone(sim.state.market);
    recipeStates.value = structuredClone(sim.state.recipes);
  };
  syncPantry();
  for (const ev of ['inventoryChanged', 'marketRefreshed', 'recipeLeveledUp', 'rankUp'] as const) {
    sim.events.on(ev, syncPantry);
  }
  sim.events.on('recipeLeveledUp', (e) => pushToast({ kind: 'level', ...e }));
  sim.events.on('giftReceived', (e) =>
    pushToast({ kind: 'gift', guestName: e.guestName, ingredient: e.ingredient }),
  );
  sim.events.on('moneyChanged', (e) => {
    money.value = e.money;
    syncLedger();
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
    rankUps.value = [
      ...rankUps.value,
      { rank: e.rank, name: e.name, unlocks: e.unlocks, reward: e.reward },
    ];
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
