import { FURNITURE } from '../data/furniture';
import { INGREDIENTS } from '../data/ingredients';
import { REGULAR_IDS } from '../data/regulars';
import { MAX_FURNITURE_LEVEL } from '../data/furniture';
import { FLOOR_STYLES, WALL_STYLES } from '../data/surfaces';
import { RECIPE_IDS } from '../data/recipes';
import { growthAtRank } from '../data/expansion';
import { GRID_HEIGHT, GRID_WIDTH, LEGACY_OFFSET, START_ROOM, type TileType } from '../data/layout';
import { expandRoom } from './systems/expansion';
import type { GameState } from './state';
import { createInventory, rollMarket } from './systems/market';
import { createCounters, createRegularStates } from './systems/regulars';

/** Save format version. Bump it when GameState changes shape and add a step to `MIGRATIONS`. */
export const SAVE_VERSION = 6;

/** Coins paid for each removed common ingredient when upgrading a v3 save (old market minimum). */
const COMMON_REFUND = 40;

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

/** Steps from older versions. */
export const MIGRATIONS: Migrations = {
  // v1 -> v2: the day's money ledger (D-033). Older days simply start with an empty one.
  1: (state) => {
    const stats = isObj(state.dayStats) ? state.dayStats : {};
    return { ...state, dayStats: { ...stats, ledger: { entries: [] } } };
  },
  // v2 -> v3: regulars and moments (M11). Nothing is unlocked yet; guests in the room get the
  // new fields as plain guests.
  2: (state) => {
    const characters = Array.isArray(state.characters)
      ? state.characters.map((c: unknown) =>
          isObj(c) && c.kind === 'guest'
            ? { regularId: null, look: null, companionOf: null, ...c }
            : c,
        )
      : state.characters;
    return {
      ...state,
      characters,
      momentsSeen: [],
      counters: createCounters(),
      regulars: createRegularStates(),
    };
  },
  // v3 -> v4: recipe levels 1-5 (D-036). Recipe levels stay. The four old common ingredients
  // are gone: each one owned is paid out as COMMON_REFUND coins. Nonna's 2-heart beat now gives
  // the exclusive basil, so a save that already saw the old beat gets one basil (else Lv.5
  // Margherita would be unreachable). The market is re-rolled (rares only) when it holds an
  // ingredient that no longer exists or is not rare.
  3: (state) => {
    const old = isObj(state.inventory) ? state.inventory : {};
    const inventory: Record<string, number> = { ...createInventory() };
    let refund = 0;
    for (const [id, n] of Object.entries(old)) {
      if (!isInt(n) || n < 0) continue;
      if (id in inventory) inventory[id] = n;
      else refund += n * COMMON_REFUND;
    }
    const seen = Array.isArray(state.momentsSeen) ? state.momentsSeen : [];
    if (seen.includes('nonna_rosa_h2') && (inventory.nonnas_secret_basil ?? 0) < 1) {
      inventory.nonnas_secret_basil = 1;
    }
    const market = isObj(state.market) ? state.market : null;
    const offers = market && Array.isArray(market.offers) ? market.offers : [];
    const valid =
      offers.length > 0 &&
      offers.every(
        (o: unknown) =>
          isObj(o) &&
          typeof o.ingredient === 'string' &&
          INGREDIENTS[o.ingredient as keyof typeof INGREDIENTS]?.rarity === 'rare',
      );
    const next: Record<string, unknown> = {
      ...state,
      inventory,
      money: (isNum(state.money) ? state.money : 0) + refund,
    };
    if (!valid) {
      // The re-roll draws from the saved RNG, so it stays deterministic.
      next.market = rollMarket(next as unknown as GameState, isInt(market?.day) ? market.day : 1);
    }
    return next;
  },
  // v4 -> v5: facility levels, floors/walls and guest errands (M12). Every piece keeps (or gets)
  // level 1, nothing is painted, guests in the room have no errand and have not snacked.
  4: (state) => {
    const furniture = Array.isArray(state.furniture)
      ? state.furniture.map((f: unknown) =>
          isObj(f) ? { ...f, level: isInt(f.level) && f.level >= 1 ? f.level : 1 } : f,
        )
      : state.furniture;
    const characters = Array.isArray(state.characters)
      ? state.characters.map((c: unknown) =>
          isObj(c) && c.kind === 'guest' ? { errand: null, snackAsked: false, ...c } : c,
        )
      : state.characters;
    return { ...state, furniture, characters, styles: { floor: {}, wall: {} } };
  },
  // v5 -> v6: the room grows with rank (M12b, D-038). The old 10x12 grid moves into the bigger
  // allocated grid by LEGACY_OFFSET, and every coordinate in the save is translated once. The
  // room is the starting room grown by every expansion up to the saved rank.
  5: (state) => {
    const { x: ox, y: oy } = LEGACY_OFFSET;
    const shiftPos = (p: unknown): unknown =>
      isObj(p) && isNum(p.x) && isNum(p.y) ? { ...p, x: p.x + ox, y: p.y + oy } : p;
    const furniture = Array.isArray(state.furniture)
      ? state.furniture.map((f: unknown) => shiftPos(f))
      : state.furniture;
    const characters = Array.isArray(state.characters)
      ? state.characters.map((c: unknown) => {
          if (!isObj(c)) return c;
          const out: Record<string, unknown> = { ...c };
          for (const k of ['x', 'prevX']) if (isNum(c[k])) out[k] = c[k] + ox;
          for (const k of ['y', 'prevY']) if (isNum(c[k])) out[k] = c[k] + oy;
          if (Array.isArray(c.path)) out.path = c.path.map(shiftPos);
          for (const k of ['target', 'home', 'waitSpot']) if (k in c) out[k] = shiftPos(c[k]);
          return out;
        })
      : state.characters;
    const styles = isObj(state.styles) ? state.styles : { floor: {}, wall: {} };
    const floor: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(isObj(styles.floor) ? styles.floor : {})) {
      const [x, y] = k.split(',').map(Number);
      floor[`${(x as number) + ox},${(y as number) + oy}`] = v;
    }
    const wall: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(isObj(styles.wall) ? styles.wall : {})) {
      const n = Number(k.slice(1));
      wall[`${k[0]}${n + (k[0] === 'l' ? oy : ox)}`] = v;
    }
    // Old tiles move; the old wall footprints are no longer stored (walls are derived).
    const old = isObj(state.grid) ? state.grid : { width: 0, height: 0, tiles: [] };
    const ow = old.width as number;
    const tiles: TileType[] = new Array<TileType>(GRID_WIDTH * GRID_HEIGHT).fill('outside');
    (old.tiles as string[]).forEach((t, i) => {
      if (t === 'wall') return;
      tiles[(Math.floor(i / ow) + oy) * GRID_WIDTH + (i % ow) + ox] = t as TileType;
    });
    const next = {
      grid: { width: GRID_WIDTH, height: GRID_HEIGHT, tiles },
      room: { ...START_ROOM },
    };
    const rank = isInt(state.rank) ? state.rank : 1;
    for (let r = 2; r <= rank; r++) {
      const growth = growthAtRank(r);
      if (growth) expandRoom(next, growth);
    }
    return { ...state, ...next, furniture, characters, styles: { floor, wall } };
  },
};

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
  if (!isObj(s.dayStats.ledger) || !Array.isArray(s.dayStats.ledger.entries))
    return 'bad:dayStats.ledger';
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
  const room = s.room;
  if (
    !isObj(room) ||
    !isInt(room.x0) ||
    !isInt(room.y0) ||
    !isInt(room.x1) ||
    !isInt(room.y1) ||
    room.x0 < 0 ||
    room.y0 < 0 ||
    room.x1 >= (grid.width as number) ||
    room.y1 >= (grid.height as number) ||
    room.x0 > room.x1 ||
    room.y0 > room.y1
  )
    return 'bad:room';

  if (!Array.isArray(s.furniture)) return 'bad:furniture';
  for (const f of s.furniture as unknown[]) {
    if (!isObj(f) || typeof f.id !== 'string' || !isInt(f.x) || !isInt(f.y) || !isInt(f.rot))
      return 'bad:furniture';
    if (!((f.defId as string) in FURNITURE)) return 'bad:furniture.defId';
    if (!isInt(f.level) || f.level < 1 || f.level > MAX_FURNITURE_LEVEL)
      return 'bad:furniture.level';
  }
  if (!isObj(s.styles) || !isObj(s.styles.floor) || !isObj(s.styles.wall)) return 'bad:styles';
  if (!Object.values(s.styles.floor).every((v) => typeof v === 'string' && v in FLOOR_STYLES))
    return 'bad:styles.floor';
  if (!Object.values(s.styles.wall).every((v) => typeof v === 'string' && v in WALL_STYLES))
    return 'bad:styles.wall';

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
  if (!Array.isArray(s.momentsSeen) || !s.momentsSeen.every((m) => typeof m === 'string'))
    return 'bad:momentsSeen';
  if (!isObj(s.counters) || !isObj(s.counters.served) || !isObj(s.counters.servedLevel))
    return 'bad:counters';
  if (!isObj(s.regulars)) return 'bad:regulars';
  for (const id of REGULAR_IDS) {
    const r = s.regulars[id];
    if (
      !isObj(r) ||
      typeof r.unlocked !== 'boolean' ||
      !isInt(r.hearts) ||
      !isInt(r.visits) ||
      !isInt(r.lastVisitDay) ||
      !isInt(r.lastHeartDay)
    )
      return 'bad:regulars';
  }
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
