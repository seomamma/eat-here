/** Balance numbers and tuning constants. No magic numbers in systems. */

/** Fixed simulation step (ARCHITECTURE §4: 10 Hz). */
export const TICK_MS = 100;
/** Max ticks run per `Game.update`; the rest of a long frame is dropped (no spiral of death). */
export const MAX_TICKS_PER_UPDATE = 5;
/** Selectable sim speed multipliers. */
export const SPEEDS = [1, 2, 3] as const;
export const DEFAULT_SEED = 1;

/** Debug walker walking speed in tiles per second. */
export const DEBUG_WALKER_SPEED = 2.5;
