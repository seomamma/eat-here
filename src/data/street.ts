/**
 * Street life (M12c, D-041): where guests come from and go to along the sidewalk, and how busy
 * the passers-by are. The sidewalk row is `SIDEWALK_Y`, one row in front of the door.
 */
import type { FurnitureDefId } from './furniture';

/** Guests spawn this many tiles from the door along the sidewalk (off screen on a phone). */
export const STREET_APPROACH_TILES = 7;
/** Party members line up this many tiles apart, so the followers walk one tile behind. */
export const STREET_FOLLOWER_GAP = 1;
/** Leaving guests walk this far along the sidewalk before they are removed. */
export const STREET_EXIT_TILES = 8;

/** Furniture that makes up an Animal Area (M16 fills this in; empty = no area, dogs get a 💔). */
export const ANIMAL_AREA_PIECES: readonly FurnitureDefId[] = [];

export interface StreetTuning {
  /** Walking speed in tiles per second. */
  walkSpeed: number;
  /** Seconds between passers-by at density 1 [min, max]. */
  intervalSec: readonly [number, number];
  /** Chance that a passer-by walks a dog. */
  dogChance: number;
  /** Chance that a dog walker stops at the door (when there is no Animal Area). */
  dogStopChance: number;
  /** Seconds a dog walker stands at the door before walking on. */
  dogStopSec: number;
  /** Tiles the sidewalk traffic spans on either side of the door. */
  reach: number;
  /** Dog sprite colours. */
  dogVariants: number;
  /** Passer-by body variants (the guest sprites). */
  bodyVariants: number;
  /** Most passers-by on the sidewalk at once. */
  maxAlive: number;
}

export const STREET: StreetTuning = {
  walkSpeed: 1.3,
  intervalSec: [5, 11],
  dogChance: 0.3,
  dogStopChance: 0.7,
  dogStopSec: 2.2,
  reach: 12,
  dogVariants: 2,
  bodyVariants: 4,
  maxAlive: 6,
};

/**
 * How busy the street is by time of day: each entry applies from `fromMinute` (minutes since
 * midnight); 1 = normal. While the restaurant is closed (`night`) the street is quiet.
 */
export const STREET_DENSITY: readonly { fromMinute: number; density: number }[] = [
  { fromMinute: 0, density: 0.5 },
  { fromMinute: 600, density: 0.8 },
  { fromMinute: 720, density: 1.2 },
  { fromMinute: 840, density: 0.8 },
  { fromMinute: 1080, density: 1.2 },
  { fromMinute: 1260, density: 0.5 },
];
export const STREET_NIGHT_DENSITY = 0.15;
