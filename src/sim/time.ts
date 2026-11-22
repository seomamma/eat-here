import {
  DAY_CLOSE_MINUTE,
  DAY_OPEN_MINUTE,
  DAY_REAL_SEC,
  DAYS_PER_WEEK,
  TICK_MS,
} from '../data/balance';

export type DayPhase = 'prep' | 'open' | 'closing' | 'report';

export interface Clock {
  day: number;
  /** Minutes since midnight (10:00 = 600), at most the closing minute. */
  minuteOfDay: number;
  /** Ticks since the restaurant opened today (the integer the minute is derived from). */
  dayTick: number;
  phase: DayPhase;
}

/** Ticks one open day (opening to closing time) lasts. */
export const DAY_TICKS = Math.round((DAY_REAL_SEC * 1000) / TICK_MS);

export function createClock(): Clock {
  return { day: 1, minuteOfDay: DAY_OPEN_MINUTE, dayTick: 0, phase: 'prep' };
}

/** Minute shown at a day tick; the clock rests at closing time while the last guests finish. */
export function minuteAtTick(dayTick: number): number {
  const minute = DAY_OPEN_MINUTE + (dayTick * (DAY_CLOSE_MINUTE - DAY_OPEN_MINUTE)) / DAY_TICKS;
  return Math.min(minute, DAY_CLOSE_MINUTE);
}

/** Weekday index 0..6 (Day 1 = Monday = 0). */
export function weekdayIndex(day: number): number {
  return (((day - 1) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** "HH:MM" for a minute-of-day value (wraps past midnight). */
export function formatClock(minuteOfDay: number): string {
  const m = Math.floor(minuteOfDay) % (24 * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Starts a fresh open day: clock back to opening time. */
export function resetClockForDay(clock: Clock, day: number): void {
  clock.day = day;
  clock.dayTick = 0;
  clock.minuteOfDay = DAY_OPEN_MINUTE;
}
