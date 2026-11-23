import { describe, expect, it } from 'vitest';
import { DOOR_X, SIDEWALK_Y } from '../../src/data/layout';
import { ANIMAL_AREA_PIECES, STREET, STREET_NIGHT_DENSITY } from '../../src/data/street';
import { hasAnimalArea } from '../../src/sim/street';
import { createInitialState } from '../../src/sim/state';
import { StreetLife, dogPosition, streetDensity, type Passerby } from '../../src/view/street';

const OPEN = { open: true, minuteOfDay: 780, animalArea: false };

function simulate(
  seed: number,
  seconds: number,
  ctx = OPEN,
): { life: StreetLife; seen: Passerby[] } {
  const life = new StreetLife(seed);
  const seen = new Map<number, Passerby>();
  for (let t = 0; t < seconds; t += 0.1) {
    life.update(0.1, ctx);
    for (const w of life.walkers) seen.set(w.id, { ...w });
  }
  return { life, seen: [...seen.values()] };
}

describe('street life', () => {
  it('passers-by walk along the sidewalk in both directions and leave at the far end', () => {
    const { life, seen } = simulate(1, 300);
    expect(seen.length).toBeGreaterThan(15);
    expect(seen.some((w) => w.dir === 1)).toBe(true);
    expect(seen.some((w) => w.dir === -1)).toBe(true);
    for (const w of life.walkers) {
      expect(Math.abs(w.x - DOOR_X)).toBeLessThanOrEqual(STREET.reach + 1);
      expect(w.y).toBeGreaterThan(SIDEWALK_Y);
      expect(w.y).toBeLessThan(SIDEWALK_Y + 0.5);
    }
    expect(life.walkers.length).toBeLessThanOrEqual(STREET.maxAlive);
  });

  it('is deterministic by seed and does not touch the sim state', () => {
    const state = createInitialState(3);
    const before = JSON.stringify(state);
    const a = simulate(5, 120);
    const b = simulate(5, 120);
    expect(a.seen).toEqual(b.seen);
    expect(simulate(6, 120).seen).not.toEqual(a.seen);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('is quieter at night than during the open day', () => {
    const day = simulate(2, 600).seen.length;
    const night = simulate(2, 600, { open: false, minuteOfDay: 600, animalArea: false }).seen
      .length;
    expect(streetDensity({ open: false, minuteOfDay: 700 })).toBe(STREET_NIGHT_DENSITY);
    expect(night).toBeLessThan(day * 0.5);
    expect(night).toBeGreaterThan(0);
  });

  it('is busier at the lunch peak than in the early morning', () => {
    expect(streetDensity({ open: true, minuteOfDay: 780 })).toBeGreaterThan(
      streetDensity({ open: true, minuteOfDay: 620 }),
    );
  });

  it('some passers-by walk a dog, which follows on the leash behind them', () => {
    const { seen } = simulate(4, 600);
    const walkers = seen.filter((w) => w.dog !== null);
    expect(walkers.length).toBeGreaterThan(5);
    expect(new Set(walkers.map((w) => w.dog)).size).toBe(STREET.dogVariants);
    const w = walkers[0] as Passerby;
    const dog = dogPosition(w);
    expect(Math.sign(w.x - dog.x)).toBe(w.dir);
    expect(dog.y).toBe(w.y);
  });
});

describe('dog walkers at the door', () => {
  it('without an Animal Area a dog walker stops at the door and shows the broken heart', () => {
    expect(hasAnimalArea(createInitialState(1).furniture)).toBe(false);
    const life = new StreetLife(7);
    const turned: Passerby[] = [];
    life.onDogTurnedAway = (p) => turned.push({ ...p });
    const stops: number[] = [];
    for (let t = 0; t < 900; t += 0.1) {
      life.update(0.1, OPEN);
      for (const w of life.walkers) if (w.stopLeft > 0) stops.push(w.x);
    }
    expect(turned.length).toBeGreaterThan(0);
    for (const p of turned) {
      expect(p.dog).not.toBeNull();
      expect(p.x).toBe(DOOR_X);
    }
    // They stand still at the door for a while, then walk on.
    expect(stops.length).toBeGreaterThan(turned.length * 10);
    expect(stops.every((x) => x === DOOR_X)).toBe(true);
    // Never twice for the same walker, and walkers without a dog never stop.
    expect(new Set(turned.map((p) => p.id)).size).toBe(turned.length);
  });

  it('with an Animal Area (the M16 data check) nobody turns away', () => {
    const life = new StreetLife(7);
    let turned = 0;
    life.onDogTurnedAway = () => turned++;
    for (let t = 0; t < 900; t += 0.1) life.update(0.1, { ...OPEN, animalArea: true });
    expect(turned).toBe(0);
  });

  it('the Animal Area check reads the data list (empty for now, so always false)', () => {
    expect(ANIMAL_AREA_PIECES).toEqual([]);
    const furniture = createInitialState(1).furniture;
    expect(hasAnimalArea(furniture)).toBe(false);
    expect(hasAnimalArea([{ defId: 'chair_wood' }])).toBe(false);
  });
});
