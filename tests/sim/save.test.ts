import fixtureText from '../fixtures/save-v1.json?raw';
import fixtureV2Text from '../fixtures/save-v2.json?raw';
import fixtureV3Text from '../fixtures/save-v3.json?raw';
import fixtureV4Text from '../fixtures/save-v4.json?raw';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS, INGREDIENT_IDS } from '../../src/data/ingredients';
import { isGuest, isStaff } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import {
  MIGRATIONS,
  SAVE_FORMAT,
  SAVE_VERSION,
  deserialize,
  migrate,
  serialize,
} from '../../src/sim/save';
import { createInitialState, type GameState } from '../../src/sim/state';
import { findFreeSpot } from '../../src/sim/systems/build';

const AT = 1_700_000_000_000;

function load(text: string): GameState {
  const res = deserialize(text);
  if (!res.ok) throw new Error(`load failed: ${res.reason}`);
  return res.state;
}

/** Same inputs for every game under comparison: only the report is acknowledged. */
function step(g: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    if (g.state.clock.phase === 'report') g.dispatch({ type: 'continueAfterReport' });
    g.tickOnce();
  }
}

function buyPlant(g: Game): void {
  const spot = findFreeSpot(g.state, 'plant_potted');
  if (!spot) throw new Error('no free spot');
  g.state.money += 500;
  expect(g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...spot, rot: 0 })).toEqual({
    ok: true,
  });
}

describe('save round trip', () => {
  it('a loaded game continues identically to the original (key determinism test)', () => {
    const a = new Game(createInitialState(11));
    step(a, 900);
    buyPlant(a);
    step(a, 400);
    const b = new Game(load(serialize(a.state, AT)));
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
    // Long enough to close the day, show the report, pass the night and start day 2.
    step(a, 4200);
    step(b, 4200);
    expect(a.state.clock.day).toBeGreaterThanOrEqual(2);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
  });

  it('mid-day with guests seated/eating and staff carrying survives a round trip', () => {
    const a = new Game(createInitialState(5));
    let seen = { eating: false, carrying: false, walking: false };
    for (let i = 0; i < 2400 && !(seen.eating && seen.carrying && seen.walking); i++) {
      step(a, 1);
      for (const c of a.state.characters) {
        if (isGuest(c) && c.phase === 'eating') seen.eating = true;
        if (isGuest(c) && c.path.length > 0) seen.walking = true;
        if (isStaff(c) && c.carrying) seen.carrying = true;
      }
      seen = { ...seen };
    }
    expect(seen).toEqual({ eating: true, carrying: true, walking: true });
    const text = serialize(a.state, AT);
    // Text -> state -> text is stable and nothing is lost to JSON (no undefined, NaN, Infinity).
    expect(serialize(load(text), AT)).toBe(text);
    expect(load(text)).toEqual(a.state);
    const b = new Game(load(text));
    step(a, 1500);
    step(b, 1500);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
  });

  it('saves the night transition and the report phase', () => {
    const a = new Game(createInitialState(2));
    step(a, 1);
    for (const phase of ['report', 'night'] as const) {
      for (let i = 0; i < 6000 && a.state.clock.phase !== phase; i++) {
        a.tickOnce();
        if (a.state.clock.phase === 'report' && phase === 'night')
          a.dispatch({ type: 'continueAfterReport' });
      }
      expect(a.state.clock.phase).toBe(phase);
      const b = new Game(load(serialize(a.state, AT)));
      step(a, 300);
      step(b, 300);
      expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
    }
  });
});

describe('deserialize', () => {
  const good = () => JSON.parse(serialize(createInitialState(1), AT)) as Record<string, unknown>;

  it('writes the envelope', () => {
    const f = good();
    expect(f.format).toBe(SAVE_FORMAT);
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.savedAt).toBe(AT);
    const res = deserialize(JSON.stringify(f));
    expect(res.ok && res.savedAt).toBe(AT);
  });

  it('rejects garbage, wrong files and broken shapes without throwing', () => {
    const reason = (text: string) => {
      const r = deserialize(text);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('')).toBe('notJson');
    expect(reason('{"format":')).toBe('notJson');
    expect(reason('[]')).toBe('notASave');
    expect(reason('{"format":"other"}')).toBe('notASave');
    const f = good();
    expect(reason(JSON.stringify({ ...f, version: 0 }))).toBe('badVersion');
    expect(reason(JSON.stringify({ ...f, version: SAVE_VERSION + 1 }))).toBe('tooNew');
    expect(reason(JSON.stringify({ ...f, state: null }))).toBe('noState');
    const broken = (patch: Record<string, unknown>) =>
      reason(JSON.stringify({ ...f, state: { ...(f.state as object), ...patch } }));
    expect(broken({ money: 'lots' })).toBe('bad:money');
    expect(broken({ rng: null })).toBe('bad:rng');
    expect(broken({ furniture: 3 })).toBe('bad:furniture');
    expect(broken({ furniture: [{ id: 'f1', defId: 'nope', x: 0, y: 0, rot: 0 }] })).toBe(
      'bad:furniture.defId',
    );
    expect(broken({ clock: { day: 1 } })).toBe('bad:clock');
    expect(broken({ characters: [{ id: 'x', kind: 'ghost', x: 0, y: 0, path: [] }] })).toBe(
      'bad:characters.kind',
    );
    expect(broken({ recipes: {} })).toBe('bad:recipes');
  });
});

describe('migrate', () => {
  it('steps version by version', () => {
    const f = {
      ...(JSON.parse(serialize(createInitialState(1), AT)) as object),
      version: 1,
    };
    const order: number[] = [];
    const steps = {
      1: (s: Record<string, unknown>) => (order.push(1), { ...s, addedInV2: true }),
      2: (s: Record<string, unknown>) => (order.push(2), { ...s, addedInV3: s.addedInV2 === true }),
    };
    const res = migrate(f, steps, 3);
    expect(order).toEqual([1, 2]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.version).toBe(3);
      expect((res.state as unknown as Record<string, unknown>).addedInV3).toBe(true);
    }
    // A save already at the target runs no steps.
    expect(migrate({ ...f, version: 3 }, steps, 3).ok).toBe(true);
    expect(order).toEqual([1, 2]);
  });

  it('fails cleanly on a missing or throwing step', () => {
    const f = { ...(JSON.parse(serialize(createInitialState(1), AT)) as object), version: 1 };
    expect(migrate(f, {}, 2)).toEqual({ ok: false, reason: 'noMigration1' });
    const bad = migrate(
      f,
      {
        1: () => {
          throw new Error('boom');
        },
      },
      2,
    );
    expect(bad).toEqual({ ok: false, reason: 'migrationFailed1' });
  });

  it('every version below the current one has a step', () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('loads the hand-kept v1 fixture and keeps playing it', () => {
    const res = deserialize(fixtureText);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.version).toBe(SAVE_VERSION);
    expect(res.state.dayStats.ledger).toEqual({ entries: [] });
    expect(res.state.clock.day).toBe(1);
    expect(res.state.furniture.some((f) => f.defId === 'plant_potted')).toBe(true);
    expect(res.state.characters.some((c) => isGuest(c))).toBe(true);
    const g = new Game(res.state);
    step(g, 300);
    expect(g.state.tick).toBeGreaterThan(500);
  });
  it('migrates a v2 save to the current version: empty moments, counters and regulars, guests become plain', () => {
    const res = deserialize(fixtureV2Text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { state } = res;
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.momentsSeen).toEqual([]);
    expect(state.counters).toEqual({ served: {}, servedLevel: {} });
    expect(state.regulars.nonna_rosa.unlocked).toBe(false);
    expect(state.regulars.oliver.hearts).toBe(0);
    const guests = state.characters.filter(isGuest);
    expect(guests.length).toBeGreaterThan(0);
    for (const c of guests) {
      expect(c.regularId).toBeNull();
      expect(c.look).toBeNull();
      expect(c.companionOf).toBeNull();
    }
    const g = new Game(state);
    step(g, 400);
    expect(g.state.tick).toBeGreaterThan(800);
  });

  it('migrates a v3 save to v4: commons become coins, market is rares only, levels stay', () => {
    const res = deserialize(fixtureV3Text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { state } = res;
    expect(state.version).toBe(SAVE_VERSION);
    expect(Object.keys(state.inventory).sort()).toEqual([...INGREDIENT_IDS].sort());
    expect(state.inventory.buffalo_mozzarella).toBe(1);
    // 2 oregano + 1 fresh basil = 3 x 40 coins on top of the saved 685.
    expect(state.money).toBe(685 + 120);
    // Nonna's old 2-heart beat was seen: the player gets the new exclusive basil.
    expect(state.inventory.nonnas_secret_basil).toBe(1);
    expect(state.recipes.margherita.level).toBe(3);
    expect(state.regulars.nonna_rosa.unlocked).toBe(true);
    expect(state.market.offers).toHaveLength(3);
    for (const o of state.market.offers) expect(INGREDIENTS[o.ingredient].rarity).toBe('rare');
    // Deterministic: the same file migrates to the same state.
    const again = deserialize(fixtureV3Text);
    expect(again.ok && again.state).toEqual(state);
    const g = new Game(state);
    step(g, 400);
    expect(g.state.tick).toBeGreaterThan(800);
  });

  it('keeps a v3 market that already has only rares', () => {
    const f = JSON.parse(fixtureV3Text) as { state: { market: unknown } };
    const market = {
      day: 3,
      offers: [{ ingredient: 'hot_honey', price: 200, bought: true }],
    };
    f.state.market = market;
    const res = deserialize(JSON.stringify(f));
    expect(res.ok && res.state.market).toEqual(market);
  });

  it('rejects a v3 state with a broken regulars block', () => {
    const f = JSON.parse(serialize(createInitialState(1), AT)) as {
      state: Record<string, unknown>;
    };
    f.state.regulars = { nonna_rosa: { unlocked: 'yes' } };
    expect(deserialize(JSON.stringify(f))).toEqual({ ok: false, reason: 'bad:regulars' });
  });

  it('migrates a v4 save to v5: levels stay, nothing painted, guests get no errand', () => {
    const raw = JSON.parse(fixtureV4Text) as { version: number; state: Record<string, unknown> };
    expect(raw.version).toBe(4);
    expect(raw.state.styles).toBeUndefined();
    const res = deserialize(fixtureV4Text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { state } = res;
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.styles).toEqual({ floor: {}, wall: {} });
    expect(state.furniture.length).toBeGreaterThan(5);
    expect(state.furniture.every((f) => f.level === 1)).toBe(true);
    const guests = state.characters.filter(isGuest);
    expect(guests.length).toBeGreaterThan(0);
    for (const c of guests) {
      expect(c.errand).toBeNull();
      expect(c.snackAsked).toBe(false);
    }
    // Same money, fame and RNG as the v4 file: the migration only adds fields.
    expect(state.money).toBe(raw.state.money);
    expect(state.rng).toBe(raw.state.rng);
    const again = deserialize(fixtureV4Text);
    expect(again.ok && again.state).toEqual(state);
    // A migrated game continues exactly like one loaded from a freshly saved v5 copy.
    const a = new Game(state);
    const b = new Game(load(serialize(state, AT)));
    step(a, 900);
    step(b, 900);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
  });

  it('rejects a broken styles block or furniture level', () => {
    const f = JSON.parse(serialize(createInitialState(1), AT)) as {
      state: { styles: unknown; furniture: { level: number }[] };
    };
    const good = JSON.stringify(f);
    f.state.styles = { floor: { '3,3': 'lava' }, wall: {} };
    expect(deserialize(JSON.stringify(f))).toEqual({ ok: false, reason: 'bad:styles.floor' });
    f.state.styles = { floor: {}, wall: {} };
    expect(deserialize(JSON.stringify(f)).ok).toBe(true);
    (f.state.furniture[0] as { level: number }).level = 9;
    expect(deserialize(JSON.stringify(f))).toEqual({ ok: false, reason: 'bad:furniture.level' });
    expect(deserialize(good).ok).toBe(true);
  });

  it('a save with upgrades, a toilet and paint round-trips', () => {
    const a = new Game(createInitialState(33));
    a.state.money = 9999;
    a.state.rank = 3;
    const spot = findFreeSpot(a.state, 'toilet');
    if (!spot) throw new Error('no spot');
    a.dispatch({ type: 'buyAndPlace', defId: 'toilet', ...spot, rot: 0 });
    const toilet = a.state.furniture.find((f) => f.defId === 'toilet');
    a.dispatch({ type: 'upgradeFurniture', id: toilet?.id ?? '' });
    a.dispatch({ type: 'paintFloor', tiles: [{ x: 5, y: 6 }], style: 'terracotta' });
    a.dispatch({ type: 'paintWall', segments: ['l4'], style: 'brick' });
    step(a, 600);
    const b = new Game(load(serialize(a.state, AT)));
    expect(b.state.styles).toEqual({ floor: { '5,6': 'terracotta' }, wall: { l4: 'brick' } });
    expect(b.state.furniture.find((f) => f.defId === 'toilet')?.level).toBe(2);
    step(a, 1500);
    step(b, 1500);
    expect(serialize(b.state, AT)).toBe(serialize(a.state, AT));
  });
});
