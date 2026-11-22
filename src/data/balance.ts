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

/** Seconds until the first guest of a new game arrives. */
export const FIRST_GUEST_SEC = 2;
/** Random gap between guest arrivals [min, max], in seconds. */
export const GUEST_SPAWN_INTERVAL_SEC = [4, 10] as const;
/** No new guests spawn while this many are in the restaurant (keeps the door tidy). */
export const MAX_GUESTS_ALIVE = 12;
/** Seconds a guest stays seated after paying before getting up. */
export const GUEST_PAY_SEC = 1;

/** Dish slots on one pass counter (2x1 counter = 2 slots); the chef waits when full. */
export const PASS_SLOTS = 2;
