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
/**
 * Guest arrival rate by time of day. Each entry applies from `fromMinute` (minutes since
 * midnight) until the next entry; the gap to the next arrival is drawn from `intervalSec`.
 * Quiet morning, lunch peak 12-14, quiet afternoon, dinner peak 18-21.
 */
export const SPAWN_CURVE: readonly {
  fromMinute: number;
  intervalSec: readonly [number, number];
}[] = [
  { fromMinute: 600, intervalSec: [8, 14] },
  { fromMinute: 720, intervalSec: [4, 7] },
  { fromMinute: 840, intervalSec: [8, 14] },
  { fromMinute: 1080, intervalSec: [4, 7] },
  { fromMinute: 1260, intervalSec: [8, 14] },
];
/** No new guests spawn while this many are in the restaurant (keeps the door tidy). */
export const MAX_GUESTS_ALIVE = 12;
/** Seconds a guest stays seated after paying before getting up. */
export const GUEST_PAY_SEC = 1;

/** Dish slots on one pass counter (2x1 counter = 2 slots); the chef waits when full. */
export const PASS_SLOTS = 2;

/** Restaurant opens at 10:00 and stops admitting guests at 22:00 (minutes since midnight). */
export const DAY_OPEN_MINUTE = 600;
export const DAY_CLOSE_MINUTE = 1320;
/** Real seconds one open day lasts at 1x speed. */
export const DAY_REAL_SEC = 240;
/** Day 1 is a Monday; weekday index = (day - 1) % 7. */
export const DAYS_PER_WEEK = 7;
/** Real seconds the night transition (report closed -> next morning) lasts at 1x speed. */
export const NIGHT_REAL_SEC = 2.5;

/** Highest recipe level the MVP ships (GAME_DESIGN §6: 1-5 later). */
export const MAX_RECIPE_LEVEL_MVP = 3;
/** Dish price = round(base price * (1 + PRICE_PER_LEVEL * (level - 1))). */
export const PRICE_PER_LEVEL = 0.15;

/** Special-ingredient sources (D-031). */
export const MARKET_SLOTS = 3;
/** Chance that one market slot offers a rare ingredient. */
export const MARKET_RARE_CHANCE = 0.2;
/** Market price range [min, max] per rarity, in coins. */
export const MARKET_PRICE: Record<'common' | 'rare', readonly [number, number]> = {
  common: [40, 70],
  rare: [180, 260],
};
/** A guest leaving with at least this happiness may leave a gift. */
export const GIFT_MIN_HAPPINESS = 80;
/** Chance of a gift per such guest. */
export const GIFT_CHANCE = 0.12;
/** Chance that a gift is a rare ingredient (otherwise common). */
export const GIFT_RARE_CHANCE = 0.4;
