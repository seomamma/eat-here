import { describe, expect, it } from 'vitest';
import { HAPPINESS_POINTS } from '../../src/data/happiness';
import { MOMENTS } from '../../src/data/moments';
import { HEART_MIN_HAPPINESS, MAX_HEARTS, REGULARS, VISIT_WINDOWS } from '../../src/data/regulars';
import { isGuest, type Guest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { deserialize, serialize } from '../../src/sim/save';
import { createInitialState, type GameState } from '../../src/sim/state';
import { checkMoments } from '../../src/sim/systems/moments';
import {
  nextVisitDay,
  onRegularPaid,
  recordServed,
  usualRecipe,
} from '../../src/sim/systems/regulars';
import { createGuest } from '../../src/sim/systems/spawner';
import { weekdayIndex } from '../../src/sim/time';

const AT = 1_700_000_000_000;
const FRIDAY = 5;
const TUESDAY = 2;

function fresh(seed = 3): Game {
  return new Game(createInitialState(seed));
}

interface Log {
  moments: string[];
  arrivals: { regularId: string; day: number; minute: number; guestId: string }[];
  paid: { guestId: string; fame: number; tip: number }[];
  hearts: { regularId: string; hearts: number; day: number }[];
}

function attach(g: Game): Log {
  const log: Log = { moments: [], arrivals: [], paid: [], hearts: [] };
  g.events.on('momentTriggered', (e) => log.moments.push(e.id));
  g.events.on('regularArrived', (e) =>
    log.arrivals.push({
      regularId: e.regularId,
      day: g.state.clock.day,
      minute: g.state.clock.minuteOfDay,
      guestId: e.guestId,
    }),
  );
  g.events.on('paid', (e) => log.paid.push({ guestId: e.guestId, fame: e.fame, tip: e.tip }));
  g.events.on('heartGained', (e) =>
    log.hearts.push({ regularId: e.regularId, hearts: e.hearts, day: g.state.clock.day }),
  );
  return log;
}

/** Plays the open day to its report, acknowledges it and runs on into the next morning. */
function playDay(g: Game, check?: () => void): void {
  for (let i = 0; i < 20000 && g.state.clock.phase !== 'report'; i++) {
    g.tickOnce();
    check?.();
  }
  expect(g.state.clock.phase).toBe('report');
  g.dispatch({ type: 'continueAfterReport' });
  for (let i = 0; i < 200 && g.state.clock.phase === 'night'; i++) g.tickOnce();
}

function setDay(g: Game, day: number): void {
  g.state.clock.day = day;
  g.state.market.day = day;
}

function guests(g: Game): Guest[] {
  return g.state.characters.filter(isGuest);
}

function claimsAreUnique(g: Game): void {
  const claims = new Set<string>();
  for (const c of guests(g)) {
    if (!c.seatId) continue;
    expect(claims.has(c.seatId)).toBe(false);
    claims.add(c.seatId);
  }
}

describe('moments engine', () => {
  it('fires a moment once, stores it, applies its reward and emits the card', () => {
    const g = fresh();
    const seen: { id: string; title: string; ingredient?: string }[] = [];
    g.events.on('momentTriggered', (e) =>
      seen.push({ id: e.id, title: e.card.title, ingredient: e.reward?.ingredient }),
    );
    g.state.regulars.nonna_rosa.hearts = 2;
    checkMoments(g.state, g.events);
    expect(seen).toEqual([
      { id: 'nonna_rosa_h2', title: 'A gift from Nonna Rosa', ingredient: 'nonnas_secret_basil' },
    ]);
    expect(g.state.inventory.nonnas_secret_basil).toBe(1);
    expect(g.state.momentsSeen).toContain('nonna_rosa_h2');
    checkMoments(g.state, g.events);
    checkMoments(g.state, g.events);
    expect(seen.length).toBe(1);
    expect(g.state.inventory.nonnas_secret_basil).toBe(1);
  });

  it('applies coin rewards (with a ledger entry) and fame rewards', () => {
    const g = fresh();
    const money = g.state.money;
    g.state.regulars.oliver.hearts = 5;
    checkMoments(g.state, g.events);
    expect(g.state.money).toBe(money + 120);
    const entry = g.state.dayStats.ledger.entries.find((e) => e.kind === 'moment');
    expect(entry?.amount).toBe(120);
    const fame = g.state.fame;
    g.state.regulars.nonna_rosa.hearts = 4;
    checkMoments(g.state, g.events);
    expect(g.state.fame).toBe(fame + 150);
    // 2 and 3 hearts fire too when they are reached at once (each exactly once).
    expect(g.state.momentsSeen.filter((m) => m.startsWith('oliver_h')).sort()).toEqual([
      'oliver_h2',
      'oliver_h3',
      'oliver_h5',
    ]);
  });

  it('has unique moment ids', () => {
    const ids = MOMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('regular unlocks', () => {
  it('Nonna Rosa unlocks exactly when a Margherita is served at Lv.4', () => {
    const g = fresh();
    const log = attach(g);
    for (const level of [1, 2, 3]) {
      g.state.recipes.margherita.level = level;
      recordServed(g.state, 'margherita');
      checkMoments(g.state, g.events);
    }
    // Other dishes at Lv.4 do not count.
    g.state.recipes.marinara.level = 4;
    recordServed(g.state, 'marinara');
    checkMoments(g.state, g.events);
    expect(g.state.regulars.nonna_rosa.unlocked).toBe(false);
    expect(log.moments).toEqual([]);
    g.state.recipes.margherita.level = 4;
    recordServed(g.state, 'margherita');
    checkMoments(g.state, g.events);
    expect(g.state.regulars.nonna_rosa.unlocked).toBe(true);
    expect(log.moments).toEqual(['regular_nonna_rosa']);
    expect(g.state.regulars.oliver.unlocked).toBe(false);
  });

  it('Oliver unlocks exactly at the 20th Pepperoni served', () => {
    const g = fresh();
    const log = attach(g);
    for (let i = 1; i <= 19; i++) {
      recordServed(g.state, 'pepperoni');
      checkMoments(g.state, g.events);
      expect(g.state.regulars.oliver.unlocked).toBe(false);
    }
    // Margherita does not count towards the Pepperoni total.
    for (let i = 0; i < 5; i++) recordServed(g.state, 'margherita');
    checkMoments(g.state, g.events);
    expect(g.state.regulars.oliver.unlocked).toBe(false);
    recordServed(g.state, 'pepperoni');
    checkMoments(g.state, g.events);
    expect(g.state.regulars.oliver.unlocked).toBe(true);
    expect(log.moments).toEqual(['regular_oliver']);
  });

  it('counts real served dishes through the sim', () => {
    const g = fresh(7);
    const log = attach(g);
    playDay(g);
    const total = Object.values(g.state.counters.served).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(log.paid.length);
    expect(total).toBeGreaterThan(5);
  });
});

describe('regular visits', () => {
  it('arrive once, on their weekday and inside their window only', () => {
    const g = fresh(4);
    const log = attach(g);
    g.state.regulars.nonna_rosa.unlocked = true;
    g.state.regulars.oliver.unlocked = true;
    g.state.recipes.pepperoni.unlocked = true;
    // Day 1 (Mon) .. day 9 (Wed): Oliver on Tue days 2 and 9, Nonna on Fri day 5.
    for (let d = 1; d <= 9; d++) playDay(g);
    const by = (id: string) => log.arrivals.filter((a) => a.regularId === id);
    expect(by('nonna_rosa').map((a) => a.day)).toEqual([FRIDAY]);
    expect(by('oliver').map((a) => a.day)).toEqual([TUESDAY, 9]);
    for (const a of log.arrivals) {
      const def = REGULARS[a.regularId as keyof typeof REGULARS];
      const [from, to] = VISIT_WINDOWS[def.visitWindow];
      expect(a.minute).toBeGreaterThanOrEqual(from);
      expect(a.minute).toBeLessThanOrEqual(to + 1);
      expect(def.visitDays).toContain(weekdayIndex(a.day));
    }
    expect(g.state.regulars.nonna_rosa.visits).toBe(1);
    expect(g.state.regulars.oliver.visits).toBe(2);
    expect(guests(g)).toEqual([]);
  });

  it('a locked regular never visits', () => {
    const g = fresh(4);
    const log = attach(g);
    setDay(g, FRIDAY);
    playDay(g);
    expect(log.arrivals).toEqual([]);
  });

  it('unlocking in the middle of the window still gives that day a visit', () => {
    const g = fresh(4);
    const log = attach(g);
    setDay(g, FRIDAY);
    g.state.clock.dayTick = 600; // 13:00, inside the lunch window
    g.state.clock.minuteOfDay = 600 + (600 * 720) / 2400;
    const minute = g.state.clock.minuteOfDay;
    expect(minute).toBeGreaterThan(VISIT_WINDOWS.lunch[0]);
    expect(minute).toBeLessThan(VISIT_WINDOWS.lunch[1]);
    g.state.regulars.nonna_rosa.unlocked = true;
    playDay(g);
    expect(log.arrivals.length).toBe(1);
    expect(log.arrivals[0]?.minute).toBeGreaterThanOrEqual(minute);
  });

  it('computes the next visit day', () => {
    expect(nextVisitDay('nonna_rosa', 1, 0)).toBe(5);
    expect(nextVisitDay('nonna_rosa', 5, 0)).toBe(5);
    expect(nextVisitDay('nonna_rosa', 5, 5)).toBe(12);
    expect(nextVisitDay('oliver', 3, 2)).toBe(9);
  });
});

describe('"Their usual!" and fame', () => {
  it('a regular orders the favorite, gets +10, and gives double fame', () => {
    const g = fresh(5);
    const log = attach(g);
    g.state.regulars.nonna_rosa.unlocked = true;
    setDay(g, FRIDAY);
    let nonna: Guest | undefined;
    let ordered: string | null = null;
    playDay(g, () => {
      const n = guests(g).find((c) => c.regularId === 'nonna_rosa');
      if (n) {
        nonna = n;
        ordered ??= n.recipeId;
      }
    });
    expect(nonna).toBeDefined();
    if (!nonna) return;
    expect(nonna.name).toBe('Nonna Rosa');
    expect(nonna.look).toBe('nonna_rosa');
    expect(ordered).toBe('margherita');
    expect(nonna.happinessLog).toContainEqual({ reason: 'usual', points: HAPPINESS_POINTS.usual });
    const payment = log.paid.find((p) => p.guestId === nonna?.id);
    expect(payment?.fame).toBe(Math.floor(nonna.happiness / 10) * 2);
    // Everybody else gives single fame.
    for (const p of log.paid) {
      if (p.guestId === nonna.id) continue;
      expect(p.fame % 1).toBe(0);
    }
  });

  it('orders normally while the favorite is not on the menu', () => {
    const g = fresh(5);
    const guest = createGuest(g.state, { variant: 0, name: 'Oliver', regularId: 'oliver' });
    expect(g.state.recipes.pepperoni.unlocked).toBe(false);
    expect(usualRecipe(g.state, guest)).toBeNull();
    g.state.recipes.pepperoni.unlocked = true;
    expect(usualRecipe(g.state, guest)).toBe('pepperoni');
    expect(usualRecipe(g.state, createGuest(g.state, { variant: 0, name: 'Anna' }))).toBeNull();
  });
});

describe('hearts', () => {
  function regularGuest(g: Game, happiness: number): Guest {
    const guest = createGuest(g.state, { variant: 0, name: 'Nonna Rosa', regularId: 'nonna_rosa' });
    guest.happiness = happiness;
    return guest;
  }

  it('need happiness of at least the threshold', () => {
    const g = fresh();
    expect(onRegularPaid(g.state, g.events, regularGuest(g, HEART_MIN_HAPPINESS - 1))).toBe(false);
    expect(g.state.regulars.nonna_rosa.hearts).toBe(0);
    expect(onRegularPaid(g.state, g.events, regularGuest(g, HEART_MIN_HAPPINESS))).toBe(true);
    expect(g.state.regulars.nonna_rosa.hearts).toBe(1);
  });

  it('give at most one heart per day and cap at 5', () => {
    const g = fresh();
    const gained: number[] = [];
    g.events.on('heartGained', (e) => gained.push(e.hearts));
    setDay(g, 5);
    expect(onRegularPaid(g.state, g.events, regularGuest(g, 90))).toBe(true);
    expect(onRegularPaid(g.state, g.events, regularGuest(g, 90))).toBe(false);
    for (let d = 12; d < 12 + 8 * 7; d += 7) {
      setDay(g, d);
      onRegularPaid(g.state, g.events, regularGuest(g, 100));
    }
    expect(g.state.regulars.nonna_rosa.hearts).toBe(MAX_HEARTS);
    expect(gained).toEqual([1, 2, 3, 4, 5]);
    // Non-regulars never give hearts.
    const plain = createGuest(g.state, { variant: 0, name: 'Anna' });
    plain.happiness = 100;
    expect(onRegularPaid(g.state, g.events, plain)).toBe(false);
  });

  it('a real visit gives a heart only with enough happiness, and the beat fires at 2 hearts', () => {
    let beats = 0;
    let gainedAny = false;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = fresh(seed);
      const log = attach(g);
      g.state.regulars.nonna_rosa.unlocked = true;
      g.state.regulars.nonna_rosa.hearts = 1;
      setDay(g, FRIDAY);
      let happiness = -1;
      playDay(g, () => {
        const n = guests(g).find((c) => c.regularId === 'nonna_rosa');
        if (n) happiness = n.happiness;
      });
      const reg = g.state.regulars.nonna_rosa;
      expect(reg.visits).toBe(1);
      if (happiness >= HEART_MIN_HAPPINESS) {
        expect(reg.hearts).toBe(2);
        expect(log.hearts.length).toBe(1);
        expect(log.moments).toContain('nonna_rosa_h2');
        expect(g.state.inventory.nonnas_secret_basil).toBeGreaterThanOrEqual(1);
        gainedAny = true;
        beats++;
      } else {
        expect(reg.hearts).toBe(1);
        expect(log.moments).not.toContain('nonna_rosa_h2');
      }
    }
    expect(gainedAny).toBe(true);
    expect(beats).toBeGreaterThan(0);
  });
});

describe("Oliver's date Mia", () => {
  it('never breaks seating, and everyone leaves by the report', () => {
    let miaSeen = false;
    let seatedTogether = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = fresh(seed);
      const log = attach(g);
      g.state.regulars.oliver.unlocked = true;
      g.state.regulars.oliver.hearts = 3;
      g.state.recipes.pepperoni.unlocked = true;
      setDay(g, TUESDAY);
      playDay(g, () => {
        claimsAreUnique(g);
        const mia = guests(g).find((c) => c.look === 'mia');
        if (mia) {
          miaSeen = true;
          const oliver = guests(g).find((c) => c.id === mia.companionOf);
          if (oliver) expect(oliver.regularId).toBe('oliver');
          expect(mia.regularId).toBeNull();
          if (oliver?.seatId && mia.seatId) {
            seatedTogether = true;
            expect(mia.seatId).not.toBe(oliver.seatId);
          }
        }
      });
      expect(guests(g)).toEqual([]);
      expect(log.arrivals.length).toBe(1);
    }
    expect(miaSeen).toBe(true);
    expect(seatedTogether).toBe(true);
  });

  it('comes along only from 3 hearts', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = fresh(seed);
      g.state.regulars.oliver.unlocked = true;
      g.state.regulars.oliver.hearts = 2;
      g.state.recipes.pepperoni.unlocked = true;
      setDay(g, TUESDAY);
      playDay(g, () => {
        expect(guests(g).some((c) => c.look === 'mia')).toBe(false);
      });
    }
  });

  it('she waits for no one when the regular is turned away: no orphan companion', () => {
    const g = fresh(2);
    g.state.regulars.oliver.unlocked = true;
    g.state.regulars.oliver.hearts = 5;
    // No chairs at all: nobody can sit.
    g.state.furniture = g.state.furniture.filter((f) => f.defId !== 'chair_wood');
    setDay(g, TUESDAY);
    playDay(g, () => claimsAreUnique(g));
    expect(guests(g)).toEqual([]);
    expect(g.state.regulars.oliver.companionDue).toBeNull();
  });
});

describe('determinism and saves', () => {
  function setup(seed: number): Game {
    const g = fresh(seed);
    g.state.regulars.nonna_rosa.unlocked = true;
    g.state.regulars.nonna_rosa.hearts = 1;
    setDay(g, FRIDAY);
    return g;
  }

  it('same seed and inputs give the same game', () => {
    const a = setup(9);
    const b = setup(9);
    playDay(a);
    playDay(b);
    expect(serialize(a.state, AT)).toBe(serialize(b.state, AT));
  });

  it('a save taken while a regular is mid-visit continues identically', () => {
    const a = setup(9);
    let guard = 0;
    while (guard++ < 20000) {
      a.tickOnce();
      const n = guests(a).find((c) => c.regularId === 'nonna_rosa');
      if (n?.phase === 'eating') break;
    }
    expect(guests(a).some((c) => c.regularId === 'nonna_rosa' && c.phase === 'eating')).toBe(true);
    const res = deserialize(serialize(a.state, AT));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const b = new Game(res.state as GameState);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
    playDay(a);
    playDay(b);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
    expect(a.state.regulars.nonna_rosa.visits).toBe(1);
  });
});
