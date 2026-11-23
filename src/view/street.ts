import { DOOR_X, SIDEWALK_Y } from '../data/layout';
import { STREET, STREET_DENSITY, STREET_NIGHT_DENSITY } from '../data/street';
import { rngInt, rngNext } from '../sim/rng';

/**
 * Passers-by on the sidewalk (M12c, D-041). View-only ambience: it has its own seeded RNG (never
 * the sim's), is not saved, and has no effect on the restaurant. Pure TS (no Phaser) so it can
 * be tested; `StreetRenderer` draws it.
 */
export interface Passerby {
  id: number;
  /** Position along the sidewalk (tile units, the door column is `DOOR_X`). */
  x: number;
  /** Sidewalk row (a little in front of where guests walk, so the two do not overlap exactly). */
  y: number;
  /** +1 = towards +x, -1 = towards -x. */
  dir: 1 | -1;
  /** Guest body variant. */
  variant: number;
  /** Dog colour variant, or null when this passer-by has no dog. */
  dog: number | null;
  /** True for a dog walker who will stop at the door (when there is no Animal Area). */
  stopsAtDoor: boolean;
  /** Seconds left of the stop at the door (> 0 while stopped), and whether it already happened. */
  stopLeft: number;
  stopped: boolean;
}

export interface StreetContext {
  /** True while the restaurant is open or closing; false at night and in the report. */
  open: boolean;
  minuteOfDay: number;
  /** True when the restaurant has an Animal Area (dogs may come in: no broken heart). */
  animalArea: boolean;
}

/** Rows a passer-by walks in front of the guests' row. */
const LANE_OFFSET = 0.28;

/** How busy the street is: by time of day, much quieter while closed. */
export function streetDensity(ctx: Pick<StreetContext, 'open' | 'minuteOfDay'>): number {
  if (!ctx.open) return STREET_NIGHT_DENSITY;
  let d = STREET_DENSITY[0]?.density ?? 1;
  for (const e of STREET_DENSITY) if (e.fromMinute <= ctx.minuteOfDay) d = e.density;
  return d;
}

/** Where the dog is relative to its walker (tiles behind along the sidewalk). */
export const DOG_LEASH_TILES = 0.85;

export class StreetLife {
  readonly walkers: Passerby[] = [];
  /** Called when a dog walker turns away at the door (shows the broken heart). */
  onDogTurnedAway: ((p: Passerby) => void) | null = null;
  private readonly rng: { rng: number };
  private untilNext = 0;
  private nextId = 1;

  constructor(seed: number) {
    // Mixed so it is not the sim's own sequence even for the same seed.
    this.rng = { rng: (seed ^ 0x9e3779b9) >>> 0 };
    this.untilNext = this.rollGap(1);
  }

  private rollGap(density: number): number {
    const [min, max] = STREET.intervalSec;
    return (min + rngNext(this.rng) * (max - min)) / Math.max(0.05, density);
  }

  private spawn(): void {
    const dir: 1 | -1 = rngNext(this.rng) < 0.5 ? 1 : -1;
    const dog =
      rngNext(this.rng) < STREET.dogChance ? rngInt(this.rng, 0, STREET.dogVariants - 1) : null;
    const stops = dog !== null && rngNext(this.rng) < STREET.dogStopChance;
    this.walkers.push({
      id: this.nextId++,
      x: DOOR_X - dir * STREET.reach,
      y: SIDEWALK_Y + LANE_OFFSET,
      dir,
      variant: rngInt(this.rng, 0, STREET.bodyVariants - 1),
      dog,
      stopsAtDoor: stops,
      stopLeft: 0,
      stopped: false,
    });
  }

  /** Advances everybody by `dtSec` and brings new passers-by along. */
  update(dtSec: number, ctx: StreetContext): void {
    this.untilNext -= dtSec;
    if (this.untilNext <= 0) {
      if (this.walkers.length < STREET.maxAlive) this.spawn();
      this.untilNext = this.rollGap(streetDensity(ctx));
    }
    for (const w of this.walkers) {
      if (w.stopLeft > 0) {
        w.stopLeft -= dtSec;
        continue;
      }
      const before = w.x;
      w.x += w.dir * STREET.walkSpeed * dtSec;
      const crossed = (DOOR_X - before) * (DOOR_X - w.x) <= 0 && before !== DOOR_X;
      if (crossed && w.stopsAtDoor && !w.stopped && !ctx.animalArea) {
        w.x = DOOR_X;
        w.stopped = true;
        w.stopLeft = STREET.dogStopSec;
        this.onDogTurnedAway?.(w);
      }
    }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i] as Passerby;
      if (Math.abs(w.x - DOOR_X) > STREET.reach + 1) this.walkers.splice(i, 1);
    }
  }
}

/** Tile position of a walker's dog (behind it, on the same lane). */
export function dogPosition(w: Passerby): { x: number; y: number } {
  return { x: w.x - w.dir * DOG_LEASH_TILES, y: w.y };
}
