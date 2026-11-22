import fixtureText from '../fixtures/save-v1.json?raw';
import { describe, expect, it } from 'vitest';
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
    const f = JSON.parse(serialize(createInitialState(1), AT)) as { version: number };
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
    const f = JSON.parse(serialize(createInitialState(1), AT)) as object;
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
    expect(res.state.clock.day).toBe(1);
    expect(res.state.furniture.some((f) => f.defId === 'plant_potted')).toBe(true);
    expect(res.state.characters.some((c) => isGuest(c))).toBe(true);
    const g = new Game(res.state);
    step(g, 300);
    expect(g.state.tick).toBeGreaterThan(500);
  });
});
