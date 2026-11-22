/** Happiness meter, fame and tips (GAME_DESIGN §4, §9). All numbers are tunable here. */

/** Happiness is clamped to 0..MAX. */
export const HAPPINESS_MAX = 100;

/** A step is "quick" when it took at most this many seconds; slow steps give 0 (no penalty). */
export const SEAT_QUICK_SEC = 15;
export const ORDER_QUICK_SEC = 10;
export const FOOD_QUICK_SEC = 25;

export const HAPPINESS_POINTS = {
  /** Always awarded when the guest sits down (D-028: a cozy place is pleasant by default). */
  welcome: 10,
  /** From arriving at the door until sitting on the chair (walking in included). */
  seated: 15,
  /** From raising the hand until the waiter has taken the order. */
  order: 10,
  /** From the order being taken until the dish is served. */
  food: 15,
} as const;

/** Dish quality points = base + recipe level * perLevel (Lv.1 = 15 ... Lv.5 = 35). */
export const QUALITY_BASE = 10;
export const QUALITY_PER_LEVEL = 5;

/** Decor appeal counts decor furniture within this Chebyshev radius (tiles) of the chair. */
export const DECOR_RADIUS = 2;
/** Upper limit of the decor points one guest can get. */
export const DECOR_CAP = 20;

/** Happiness at or above this level ends the visit with a "love" emote. */
export const LOVE_AT = 80;

/** Fame per guest on leaving = floor(happiness / FAME_DIVISOR). */
export const FAME_DIVISOR = 10;
/** Tip = round(price * happiness / TIP_DIVISOR). */
export const TIP_DIVISOR = 200;

/** Happiness points per displayed star (5 stars = 100). */
export const HAPPINESS_PER_STAR = 20;
export const STAR_COUNT = 5;
