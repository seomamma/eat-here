import { FURNITURE } from '../data/furniture';
import { INGREDIENTS } from '../data/ingredients';
import { RECIPE_IDS } from '../data/recipes';
import type { GameState } from './state';

/** Save format version. Bump it when GameState changes shape and add a step to `MIGRATIONS`. */
export const SAVE_VERSION = 1;

export const SAVE_FORMAT = 'eat-here-save';

/** What is written to storage: a small envelope around the full GameState (D-032). */
export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  /** Wall-clock time of the save (ms since epoch); informational only, never read by the sim. */
  savedAt: number;
  state: GameState;
}

export type LoadResult =
  { ok: true; state: GameState; savedAt: number } | { ok: false; reason: string };

/** One step upgrades a raw state from version N to N + 1 (key = N). */
export type Migrations = Record<
  number,
  (state: Record<string, unknown>) => Record<string, unknown>
>;

/** Steps from older versions; empty while v1 is the only format. */
export const MIGRATIONS: Migrations = {};

/** `savedAt` is passed in so this stays pure (the caller owns the clock). */
export function serialize(state: GameState, savedAt: number): string {
  const file: SaveFile = { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file);
}

export function deserialize(
  text: string,
  migrations: Migrations = MIGRATIONS,
  target: number = SAVE_VERSION,
): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  return migrate(raw, migrations, target);
}

/** Checks the envelope, upgrades the state version by version, then validates its shape. */
/** `target` is the version to upgrade to (the current one; a parameter so tests can chain steps). */
export function migrate(
  raw: unknown,
  migrations: Migrations = MIGRATIONS,
  target: number = SAVE_VERSION,
): LoadResult {
  if (!isObj(raw) || raw.format !== SAVE_FORMAT) return { ok: false, reason: 'notASave' };
  const { version } = raw;
  if (!Number.isInteger(version) || (version as number) < 1)
    return { ok: false, reason: 'badVersion' };
  if ((version as number) > target) return { ok: false, reason: 'tooNew' };
  if (!isObj(raw.state)) return { ok: false, reason: 'noState' };
  let state: Record<string, unknown> = raw.state;
  for (let v = version as number; v < target; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: `noMigration${v}` };
    try {
      state = step(state);
    } catch {
      return { ok: false, reason: `migrationFailed${v}` };
    }
  }
  state.version = target;
  const problem = validateState(state);
  if (problem) return { ok: false, reason: problem };
  const savedAt = typeof raw.savedAt === 'number' ? raw.savedAt : 0;
  return { ok: true, state: state as unknown as GameState, savedAt };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInt(v: unknown): v is number {
  return Number.isInteger(v);
}

/** Shape check of what the sim cannot do without; returns a problem name or null. */
export function validateState(s: Record<string, unknown>): string | null {
  for (const k of [
    'seed',
    'rng',
    'tick',
    'money',
    'spentOnBuilding',
    'fame',
    'rank',
    'nextGuestId',
    'nextFurnitureId',
    'nextJobId',
    'nextOrderId',
  ]) {
    if (!isNum(s[k])) return `bad:${k}`;
  }
  if (!isInt(s.rank) || (s.rank as number) < 1) return 'bad:rank';
  const clock = s.clock;
  if (!isObj(clock)) return 'bad:clock';
  if (
    !isInt(clock.day) ||
    !isNum(clock.minuteOfDay) ||
    !isNum(clock.dayTick) ||
    !isNum(clock.nightTicks)
  )
    return 'bad:clock';
  if (!['open', 'closing', 'report', 'night'].includes(clock.phase as string))
    return 'bad:clock.phase';
  if (!isObj(s.dayStats) || !isObj(s.dayStats.ordersByRecipe)) return 'bad:dayStats';
  if (
    !isObj(s.guestSpawn) ||
    typeof s.guestSpawn.enabled !== 'boolean' ||
    !isNum(s.guestSpawn.nextInTicks)
  )
    return 'bad:guestSpawn';

  const grid = s.grid;
  if (!isObj(grid) || !isInt(grid.width) || !isInt(grid.height) || !Array.isArray(grid.tiles))
    return 'bad:grid';
  if (grid.tiles.length !== (grid.width as number) * (grid.height as number))
    return 'bad:grid.tiles';

  if (!Array.isArray(s.furniture)) return 'bad:furniture';
  for (const f of s.furniture as unknown[]) {
    if (!isObj(f) || typeof f.id !== 'string' || !isInt(f.x) || !isInt(f.y) || !isInt(f.rot))
      return 'bad:furniture';
    if (!((f.defId as string) in FURNITURE)) return 'bad:furniture.defId';
  }

  if (!Array.isArray(s.characters)) return 'bad:characters';
  for (const c of s.characters as unknown[]) {
    if (
      !isObj(c) ||
      typeof c.id !== 'string' ||
      !isNum(c.x) ||
      !isNum(c.y) ||
      !Array.isArray(c.path)
    )
      return 'bad:characters';
    if (!['debug', 'guest', 'staff'].includes(c.kind as string)) return 'bad:characters.kind';
  }
  if (!Array.isArray(s.jobs)) return 'bad:jobs';
  if (!Array.isArray(s.orders)) return 'bad:orders';

  if (!isObj(s.recipes)) return 'bad:recipes';
  for (const id of RECIPE_IDS) {
    const r = s.recipes[id];
    if (!isObj(r) || typeof r.unlocked !== 'boolean' || !isInt(r.level)) return 'bad:recipes';
  }
  if (!isObj(s.inventory)) return 'bad:inventory';
  for (const id of Object.keys(INGREDIENTS)) if (!isNum(s.inventory[id])) return 'bad:inventory';
  if (!isObj(s.market) || !isNum(s.market.day) || !Array.isArray(s.market.offers))
    return 'bad:market';
  return null;
}
