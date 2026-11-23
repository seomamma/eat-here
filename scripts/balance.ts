/**
 * Headless balance runner (M10): plays N days for several seeds with a simple scripted player
 * and reports money / fame / rank curves. Pure sim, no DOM. Run with `npm run balance`.
 */
import { DOOR_X } from '../src/data/layout';
import { DECOR_RADIUS } from '../src/data/happiness';
import { FURNITURE, type FurnitureDefId } from '../src/data/furniture';
import type { IngredientId } from '../src/data/ingredients';
import { RECIPE_IDS, RECIPES } from '../src/data/recipes';
import { REGULAR_IDS, regularDef } from '../src/data/regulars';
import type { PartyKind } from '../src/data/parties';
import { CAMPAIGNS } from '../src/data/campaigns';
import { isGuest, isStaff } from '../src/sim/characters';
import { ledgerTotal, profitOf } from '../src/sim/dayStats';
import { Game } from '../src/sim/game';
import { createInitialState } from '../src/sim/state';
import { autoFaceRot, validateBuy, validatePlacement } from '../src/sim/systems/build';
import { upgradeCostOf } from '../src/sim/systems/facilities';
import type { Rot } from '../src/data/furniture';
import { nextUpgrade } from '../src/sim/systems/recipes';
import { DAY_TICKS } from '../src/sim/time';

export interface DayRow {
  day: number;
  /** Money at the end of the day (after the player's purchases that day). */
  money: number;
  profit: number;
  fame: number;
  rank: number;
  avgHappiness: number;
  gifts: number;
  /** Share (0..1) of arriving guests that left because no seat came free. */
  noSeat: number;
  bigTip: number;
  served: number;
  plants: number;
  /** Furniture pieces placed (the start layout counts) and the sum of their levels. */
  pieces: number;
  levels: number;
  /** Today's vending income and total income (dishes + tips + vending). */
  vending: number;
  income: number;
  /** Coins spent today on furniture, furniture upgrades and floors/walls. */
  buildSpend: number;
  /** Guests that arrived today, mean seconds from the waiting spot to a chair, share of the open day the chef was busy. */
  arrived: number;
  avgWaitSec: number;
  chefBusy: number;
}

export interface RunResult {
  seed: number;
  days: DayRow[];
  /** Day on which rank 2 was reached (null if not within the run). */
  rank2Day: number | null;
  /** Day each rank 2..6 was reached (null = not within the run). */
  rankDay: Record<number, number | null>;
  /** Day on which the first plant was bought (null if never). */
  plantDay: number | null;
  /** First day (at its end) any dish had reached Lv.2..5 (null = not within the run). */
  levelDay: Record<number, number | null>;
  /** Day each regular became a regular (null = not within the run), and hearts at the end. */
  regulars: Record<string, { unlockDay: number | null; hearts: number }>;
  /** Parties that arrived over the run, by kind, and the kids among the guests (M12c). */
  mix: Record<PartyKind, number>;
  kids: number;
}

/** Coins the player keeps back for ingredients before spending on anything. */
const RESERVE = 30;
/** How often (ticks) the scripted player looks around while the day runs. */
const THINK_EVERY_TICKS = 50;

/** Decor spot: the free tile with the most chairs within `radius` (chairs near a wall win ties). */
function bestDecorSpot(
  game: Game,
  defId: FurnitureDefId,
  radius = DECOR_RADIUS,
): { x: number; y: number } | null {
  const { state } = game;
  const chairs = state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = state.room.y0; y <= state.room.y1; y++) {
    for (let x = state.room.x0; x <= state.room.x1; x++) {
      if (!validateBuy({ ...state, money: 1e9, rank: 9 }, defId, x, y, 0).ok) continue;
      const score = chairs.filter(
        (c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= radius,
      ).length;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best;
}

/** Free-standing spot for an item with a use spot (vending, toilet): nearest to the door. */
function doorSpot(game: Game, defId: FurnitureDefId): { x: number; y: number } | null {
  const { state } = game;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = state.room.y0; y <= state.room.y1 - 2; y++) {
    for (let x = state.room.x0; x <= state.room.x1; x++) {
      if (!validateBuy({ ...state, money: 1e9, rank: 9 }, defId, x, y, 0).ok) continue;
      const d = Math.abs(x - DOOR_X) + Math.abs(y - (state.room.y1 - 2));
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}

const SIDES: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Tiles around a table footprint where a chair can go (valid, not blocking), with its rotation. */
function chairSpots(game: Game, tableId: string): { x: number; y: number; rot: Rot }[] {
  const { state } = game;
  const table = state.furniture.find((f) => f.id === tableId);
  if (!table) return [];
  const tiles = new Set<string>();
  const own = state.furniture.filter((f) => f.id === tableId);
  const out: { x: number; y: number; rot: Rot }[] = [];
  for (const f of own) {
    const fp = FURNITURE[f.defId].footprint;
    const [fw, fh] = f.rot % 2 === 1 ? [fp[1], fp[0]] : fp;
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        for (const [sx, sy] of SIDES) {
          const x = f.x + dx + sx;
          const y = f.y + dy + sy;
          if (tiles.has(`${x},${y}`)) continue;
          tiles.add(`${x},${y}`);
          const rot = autoFaceRot(state.furniture, x, y);
          if (validatePlacement(state, 'chair_wood', x, y, rot).ok) out.push({ x, y, rot });
        }
      }
    }
  }
  return out;
}

/**
 * Buys a table and `chairs` chairs around it at the spot with the most room for chairs. Spends
 * nothing and returns false when the money does not cover the whole set.
 */
function buySet(
  game: Game,
  tableDef: FurnitureDefId,
  chairDef: FurnitureDefId,
  chairs: number,
  reserve: number,
): boolean {
  const { state } = game;
  const total = FURNITURE[tableDef].price + chairs * FURNITURE[chairDef].price;
  if (state.money < total + reserve) return false;
  let best: { x: number; y: number; rot: Rot; n: number } | null = null;
  for (let y = state.room.y0 + 1; y <= state.room.y1 - 2; y++) {
    for (let x = state.room.x0; x <= state.room.x1; x++) {
      for (const rot of tableDef === 'table_long' ? ([0, 1] as const) : ([0] as const)) {
        if (!validateBuy({ ...state, money: 1e9, rank: 9 }, tableDef, x, y, rot).ok) continue;
        state.furniture.push({ id: '__probe', defId: tableDef, x, y, rot, level: 1 });
        const n = chairSpots(game, '__probe').length;
        state.furniture.pop();
        if (n >= chairs && (!best || n > best.n)) best = { x, y, rot, n };
      }
    }
  }
  if (!best) return false;
  if (
    !game.dispatch({ type: 'buyAndPlace', defId: tableDef, x: best.x, y: best.y, rot: best.rot }).ok
  )
    return false;
  const table = state.furniture[state.furniture.length - 1];
  if (!table) return false;
  let placed = 0;
  for (const spot of chairSpots(game, table.id)) {
    if (placed >= chairs) break;
    const res = game.dispatch({
      type: 'buyAndPlace',
      defId: chairDef,
      x: spot.x,
      y: spot.y,
      rot: spot.rot,
    });
    if (res.ok) placed++;
  }
  return true;
}

/** Ingredients the next upgrades of every unlocked recipe still need and the player lacks. */
function neededIngredients(game: Game): IngredientId[] {
  const out: IngredientId[] = [];
  for (const id of RECIPE_IDS) {
    const r = game.state.recipes[id];
    if (!r.unlocked) continue;
    const up = nextUpgrade(id, r.level);
    if (up?.ingredient && game.state.inventory[up.ingredient] < 1) out.push(up.ingredient);
  }
  return out;
}

/** `BALANCE_SKIP=toilet,table_long npm run balance` leaves those pieces out (for experiments). */
const SKIP_ITEMS = new Set(
  (
    (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
      .BALANCE_SKIP ?? ''
  )
    .split(',')
    .filter(Boolean),
);

/** What the scripted player builds, in order, with caps (so the room does not become clutter). */
const BUILD_PLAN: readonly {
  defId: FurnitureDefId;
  /** Total pieces of this kind wanted (the start layout counts). */
  cap: number;
  /** `set` buys a table with `chairs` chairs; `decor` buys at the best decor spot; `door` near the door. */
  how: 'set' | 'decor' | 'door' | 'chair';
  chairDef?: FurnitureDefId;
  chairs?: number;
}[] = [
  // Groups and families (Rank 2+) need a table for four, and a high chair for the little ones.
  { defId: 'table_long', cap: 1, how: 'set', chairDef: 'chair_wood', chairs: 4 },
  { defId: 'chair_high', cap: 2, how: 'chair' },
  { defId: 'table_small', cap: 3, how: 'set', chairDef: 'chair_wood', chairs: 2 },
  { defId: 'plant_potted', cap: 4, how: 'decor' },
  { defId: 'flower_box', cap: 2, how: 'decor' },
  { defId: 'toilet', cap: 1, how: 'door' },
  { defId: 'vending_machine', cap: 1, how: 'door' },
  { defId: 'floor_lamp', cap: 1, how: 'decor' },
  { defId: 'painting_easel', cap: 1, how: 'decor' },
  { defId: 'piano', cap: 1, how: 'decor' },
  { defId: 'statue', cap: 1, how: 'decor' },
];
/** Extra tables and chairs are only bought once the oven is at least this level. */
const SEATS_FROM_OVEN_LEVEL = 3;
/** Level the scripted player takes each kind of piece to (capped: a few upgrades, not all). */
const UPGRADE_TARGET: Partial<Record<FurnitureDefId, number>> = {
  oven_pizza: 5,
  counter_pass: 2,
  chair_wood: 2,
  chair_cushion: 3,
  chair_high: 2,
  table_small: 2,
  table_long: 3,
  plant_potted: 3,
  flower_box: 2,
  floor_lamp: 2,
  painting_easel: 3,
  piano: 3,
  statue: 3,
  vending_machine: 3,
  toilet: 3,
};
/** Coins kept back before furniture upgrades (more than for dishes: they are optional). */
const UPGRADE_RESERVE = 120;

/**
 * Coins the player holds back for the next dish upgrades before spending on furniture: dishes
 * come first (they raise happiness and price), the room is built with what is left.
 */
function recipeReserve(game: Game): number {
  let need = 0;
  for (const id of RECIPE_IDS) {
    const r = game.state.recipes[id];
    const up = r.unlocked ? nextUpgrade(id, r.level) : null;
    if (!up) continue;
    need = need === 0 ? up.coins : Math.min(need, up.coins);
  }
  return need;
}

/** One round of the scripted player's decisions. */
function think(game: Game, log: { plantDay: number | null }): void {
  const { state } = game;
  if (state.clock.phase === 'night') return;
  // From Rank 2 groups and families come: the player saves up for a table for four first.
  const needsBigTable =
    state.rank >= 2 &&
    !state.furniture.some((f) => f.defId === 'table_long') &&
    !SKIP_ITEMS.has('table_long');
  if (needsBigTable) {
    const total = FURNITURE.table_long.price + 4 * FURNITURE.chair_wood.price + RESERVE;
    if (state.money < total) return;
    if (buySet(game, 'table_long', 'chair_wood', 4, RESERVE)) return;
  }
  // Upgrade whatever can be upgraded (keeps the reserve).
  for (const id of RECIPE_IDS) {
    const r = state.recipes[id];
    const up = r.unlocked ? nextUpgrade(id, r.level) : null;
    if (up && state.money - up.coins >= RESERVE)
      game.dispatch({ type: 'upgradeRecipe', recipeId: id });
  }
  // The oven first: the chef is the bottleneck of the whole restaurant (extra seats only make
  // the queue longer until the kitchen is faster).
  const oven = state.furniture.find((f) => f.defId === 'oven_pizza');
  const ovenCost = oven ? upgradeCostOf(oven) : null;
  const plants = state.furniture.filter((f) => f.defId === 'plant_potted').length;
  if (
    oven &&
    ovenCost !== null &&
    oven.level < 5 &&
    plants >= 2 &&
    state.money - ovenCost >= RESERVE
  ) {
    game.dispatch({ type: 'upgradeFurniture', id: oven.id });
  }
  // Build: the first wanted piece that is unlocked and affordable (one per round), always
  // leaving the coins for the next dish upgrade.
  const keep = RESERVE + recipeReserve(game);
  for (const item of BUILD_PLAN) {
    if (SKIP_ITEMS.has(item.defId)) continue;
    const have = state.furniture.filter((f) => f.defId === item.defId).length;
    if (have >= item.cap) continue;
    if (
      state.rank <
      (FURNITURE[item.defId].unlock === 'start'
        ? 1
        : (FURNITURE[item.defId].unlock as { rank: number }).rank)
    )
      continue;
    if (item.how === 'chair') {
      if (state.money < FURNITURE[item.defId].price + keep) continue;
      const tables = state.furniture.filter((f) => f.defId === 'table_long');
      const spot = tables.flatMap((t) => chairSpots(game, t.id))[0];
      if (!spot) continue;
      if (game.dispatch({ type: 'buyAndPlace', defId: item.defId, ...spot }).ok) break;
      continue;
    }
    if (item.how === 'set') {
      if ((oven?.level ?? 1) < SEATS_FROM_OVEN_LEVEL && item.defId !== 'table_long') continue;
      const hold = item.defId === 'table_long' ? RESERVE : keep;
      if (buySet(game, item.defId, item.chairDef ?? 'chair_wood', item.chairs ?? 2, hold)) break;
      continue;
    }
    // The first plants are cheap and lift happiness at once: they only keep the plain reserve.
    const hold = item.defId === 'plant_potted' ? RESERVE : keep;
    if (state.money < FURNITURE[item.defId].price + hold) continue;
    const spot =
      item.how === 'decor'
        ? bestDecorSpot(game, item.defId, item.defId === 'piano' ? 3 : DECOR_RADIUS)
        : doorSpot(game, item.defId);
    if (!spot) continue;
    const res = game.dispatch({ type: 'buyAndPlace', defId: item.defId, ...spot, rot: 0 });
    if (res.ok) {
      if (item.defId === 'plant_potted' && log.plantDay === null) log.plantDay = state.clock.day;
      break;
    }
  }
  // Furniture upgrades: the cheapest next level first, up to the targets above.
  const candidates = state.furniture
    .map((f) => ({ f, cost: upgradeCostOf(f) }))
    .filter(
      (e): e is { f: (typeof state.furniture)[number]; cost: number } =>
        e.cost !== null && e.f.level < (UPGRADE_TARGET[e.f.defId] ?? 1),
    )
    // The oven comes first: the chef is the bottleneck of the whole restaurant.
    .sort(
      (a, b) =>
        Number(b.f.defId === 'oven_pizza') - Number(a.f.defId === 'oven_pizza') || a.cost - b.cost,
    );
  const next = candidates[0];
  if (next && state.money - next.cost >= UPGRADE_RESERVE + recipeReserve(game)) {
    game.dispatch({ type: 'upgradeFurniture', id: next.f.id });
  }
  // Buy market ingredients that unlock an upgrade (cheapest first), keeping the reserve.
  const wanted = neededIngredients(game);
  const offers = state.market.offers
    .map((o, index) => ({ o, index }))
    .filter(({ o }) => !o.bought && wanted.includes(o.ingredient))
    .sort((a, b) => a.o.price - b.o.price);
  for (const { o, index } of offers) {
    if (state.money - o.price >= RESERVE) game.dispatch({ type: 'buyMarketOffer', index });
  }
}

/** Plays `days` days with one seed. */
export interface RunOptions {
  /** Starts a Flyers campaign at the opening of this day (to measure its effect). */
  flyersOnDay?: number;
}

export function runSeed(seed: number, days: number, opts: RunOptions = {}): RunResult {
  const game = new Game(createInitialState(seed));
  const result: RunResult = {
    seed,
    days: [],
    rank2Day: null,
    rankDay: { 2: null, 3: null, 4: null, 5: null, 6: null },
    plantDay: null,
    levelDay: { 2: null, 3: null, 4: null, 5: null },
    regulars: {},
    mix: { solo: 0, couple: 0, friends: 0, family: 0 },
    kids: 0,
  };
  const seenParties = new Set<string>();
  for (const id of REGULAR_IDS) result.regulars[id] = { unlockDay: null, hearts: 0 };
  const log = { plantDay: null as number | null };
  let happy: number[] = [];
  let arrived = 0;
  let bigTip = 0;
  let waits: number[] = [];
  let chefTicks: number;
  let openTicks: number;
  /** Tick each guest began waiting for a seat (the walk in from the street does not count). */
  const waitStart = new Map<string, number>();
  game.events.on('guestArrived', (e) => {
    arrived++;
    const g = game.state.characters.find((c) => c.id === e.guestId);
    if (!g || !isGuest(g)) return;
    if (g.kid) result.kids++;
    if (!g.partyId) result.mix.solo++;
    else if (!seenParties.has(g.partyId)) {
      seenParties.add(g.partyId);
      const party = game.state.parties.find((p) => p.id === g.partyId);
      if (party) result.mix[party.kind]++;
    }
  });
  game.events.on('guestSeated', (e) => {
    const t = waitStart.get(e.guestId);
    if (t !== undefined) waits.push((game.state.tick - t) / 10);
    waitStart.delete(e.guestId);
  });
  game.events.on('paid', (e) => {
    const g = game.state.characters.find((c) => c.id === e.guestId);
    if (g && isGuest(g)) happy.push(g.happiness);
    bigTip = Math.max(bigTip, e.tip);
  });
  game.events.on('momentTriggered', (e) => {
    const id = e.reward?.unlockRegular;
    const entry = id ? result.regulars[id] : undefined;
    if (entry && entry.unlockDay === null) entry.unlockDay = game.state.clock.day;
  });
  game.events.on('rankUp', (e) => {
    if (e.rank === 2 && result.rank2Day === null) result.rank2Day = game.state.clock.day;
    if (result.rankDay[e.rank] === null) result.rankDay[e.rank] = game.state.clock.day;
  });
  const maxTicks = DAY_TICKS * 3;
  for (let d = 1; d <= days; d++) {
    happy = [];
    arrived = 0;
    bigTip = 0;
    waits = [];
    chefTicks = 0;
    openTicks = 0;
    if (d === opts.flyersOnDay) game.dispatch({ type: 'startCampaign', id: 'flyers' });
    think(game, log);
    for (let i = 0; i < maxTicks && game.state.clock.phase !== 'report'; i++) {
      game.tickOnce();
      for (const c of game.state.characters) {
        if (isGuest(c) && c.phase === 'waitingForSeat' && !waitStart.has(c.id))
          waitStart.set(c.id, game.state.tick);
        if (isStaff(c) && c.role === 'chef' && c.phase !== 'idle') chefTicks++;
      }
      openTicks++;
      if (i % THINK_EVERY_TICKS === 0) think(game, log);
    }
    const stats = game.state.dayStats;
    result.days.push({
      arrived,
      avgWaitSec: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
      chefBusy: openTicks ? chefTicks / openTicks : 0,
      day: d,
      money: game.state.money,
      profit: profitOf(stats),
      fame: game.state.fame,
      rank: game.state.rank,
      avgHappiness: happy.length ? happy.reduce((a, b) => a + b, 0) / happy.length : 0,
      gifts: stats.gifts,
      noSeat: arrived > 0 ? stats.guestsLeftNoSeat / arrived : 0,
      bigTip,
      served: stats.guestsServed,
      plants: game.state.furniture.filter((f) => f.defId === 'plant_potted').length,
      pieces: game.state.furniture.length,
      levels: game.state.furniture.reduce((n, f) => n + f.level, 0),
      vending: ledgerTotal(stats.ledger, 'vending'),
      income: stats.income,
      buildSpend:
        -ledgerTotal(stats.ledger, 'furniture') -
        stats.ledger.entries
          .filter((e) => e.kind === 'upgrade' && (e.label.split(':')[0] ?? '') in FURNITURE)
          .reduce((n, e) => n + e.amount, 0),
    });
    const top = Math.max(...RECIPE_IDS.map((id) => game.state.recipes[id].level));
    for (let lv = 2; lv <= 5; lv++)
      if (top >= lv && result.levelDay[lv] === null) result.levelDay[lv] = d;
    game.dispatch({ type: 'continueAfterReport' });
    // Run through the night into the next morning.
    for (let i = 0; i < 100 && game.state.clock.phase === 'night'; i++) game.tickOnce();
  }
  result.plantDay = log.plantDay;
  for (const id of REGULAR_IDS)
    (result.regulars[id] as { hearts: number }).hearts = game.state.regulars[id].hearts;
  return result;
}

export const DEFAULT_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function runBalance(seeds: readonly number[] = DEFAULT_SEEDS, days = 10): RunResult[] {
  return seeds.map((s) => runSeed(s, days));
}

/** Day-by-day effect of a Flyers campaign started on `day` (same seeds, with and without). */
export function campaignEffect(seeds: readonly number[], day = 3): string {
  const rows = (flyers: boolean) =>
    seeds.map((s) => runSeed(s, day, flyers ? { flyersOnDay: day } : {}).days[day - 1] as DayRow);
  const base = rows(false);
  const ads = rows(true);
  const m = (xs: DayRow[], f: (r: DayRow) => number) => mean(xs.map(f));
  const cost = CAMPAIGNS.flyers.cost;
  const arrive = [m(base, (r) => r.arrived), m(ads, (r) => r.arrived)];
  const served = [m(base, (r) => r.served), m(ads, (r) => r.served)];
  const profit = [m(base, (r) => r.profit), m(ads, (r) => r.profit) - cost];
  const fame = [m(base, (r) => r.fame), m(ads, (r) => r.fame)];
  return (
    `Flyers on day ${day} (${cost} coins), mean of ${seeds.length} seeds, without -> with: ` +
    `arrivals ${arrive[0]?.toFixed(1)} -> ${arrive[1]?.toFixed(1)}, ` +
    `served ${served[0]?.toFixed(1)} -> ${served[1]?.toFixed(1)}, ` +
    `profit after the ad ${profit[0]?.toFixed(0)} -> ${profit[1]?.toFixed(0)}, ` +
    `total fame ${fame[0]?.toFixed(0)} -> ${fame[1]?.toFixed(0)}`
  );
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Formats per-day averages over all seeds, plus the milestones. */
export function formatReport(results: RunResult[]): string {
  const days = results[0]?.days.length ?? 0;
  const lines: string[] = [];
  const head = [
    'day',
    'money',
    'profit',
    'fame',
    'rank',
    'happy',
    'served',
    'gifts',
    'noSeat%',
    'bigTip',
    'stars',
    'pieces',
    'lvSum',
    'vend',
    'build',
    'arrive',
    'wait s',
    'chef%',
  ];
  lines.push(head.map((h) => h.padStart(8)).join(''));
  for (let i = 0; i < days; i++) {
    const rows = results.map((r) => r.days[i]).filter((r): r is DayRow => r !== undefined);
    const cells = [
      String(i + 1),
      mean(rows.map((r) => r.money)).toFixed(0),
      mean(rows.map((r) => r.profit)).toFixed(0),
      mean(rows.map((r) => r.fame)).toFixed(0),
      mean(rows.map((r) => r.rank)).toFixed(1),
      mean(rows.map((r) => r.avgHappiness)).toFixed(0),
      mean(rows.map((r) => r.served)).toFixed(1),
      mean(rows.map((r) => r.gifts)).toFixed(1),
      (mean(rows.map((r) => r.noSeat)) * 100).toFixed(0),
      mean(rows.map((r) => r.bigTip)).toFixed(1),
      (mean(rows.map((r) => r.avgHappiness)) / 20).toFixed(1),
      mean(rows.map((r) => r.pieces)).toFixed(0),
      mean(rows.map((r) => r.levels)).toFixed(0),
      mean(rows.map((r) => r.vending)).toFixed(0),
      mean(rows.map((r) => r.buildSpend)).toFixed(0),
      mean(rows.map((r) => r.arrived)).toFixed(1),
      mean(rows.map((r) => r.avgWaitSec)).toFixed(1),
      (mean(rows.map((r) => r.chefBusy)) * 100).toFixed(0),
    ];
    lines.push(cells.map((c) => c.padStart(8)).join(''));
  }
  const r2 = results.map((r) => r.rank2Day);
  const plant = results.map((r) => r.plantDay);
  const minProfit = Math.min(...results.flatMap((r) => r.days.map((d) => d.profit)));
  const minBigTip = Math.min(...results.flatMap((r) => r.days.map((d) => d.bigTip)));
  const fmt = (xs: (number | null)[]) => xs.map((x) => x ?? '-').join(' ');
  for (let lv = 2; lv <= 5; lv++) {
    const found = results.flatMap((r) =>
      r.levelDay[lv] === null ? [] : [r.levelDay[lv] as number],
    );
    lines.push(
      `First dish at Lv.${lv}: ${found.length}/${results.length} seeds, ` +
        `mean day ${found.length ? mean(found).toFixed(1) : '-'} ` +
        `(per seed: ${fmt(results.map((r) => r.levelDay[lv] ?? null))})`,
    );
  }
  lines.push('');
  for (let rk = 2; rk <= 4; rk++) {
    const found = results.flatMap((r) => (r.rankDay[rk] == null ? [] : [r.rankDay[rk] as number]));
    lines.push(
      `Rank ${rk} reached: ${found.length}/${results.length} seeds, ` +
        `mean day ${found.length ? mean(found).toFixed(1) : '-'} ` +
        `(per seed: ${fmt(results.map((r) => r.rankDay[rk] ?? null))})`,
    );
  }
  const totalVend = results.flatMap((r) => r.days).reduce((n, d) => n + d.vending, 0);
  const totalIncome = results.flatMap((r) => r.days).reduce((n, d) => n + d.income, 0);
  const totalBuild = results.flatMap((r) => r.days).reduce((n, d) => n + d.buildSpend, 0);
  lines.push(
    `Vending income share: ${((totalVend / Math.max(1, totalIncome)) * 100).toFixed(1)}% of income ` +
      `(${(totalVend / results.length).toFixed(0)} coins per run); ` +
      `spent on furniture, upgrades and paint: ${(totalBuild / results.length).toFixed(0)} per run`,
  );
  lines.push(`Rank 2 day per seed:     ${fmt(r2)}`);
  lines.push(`First plant day per seed: ${fmt(plant)}`);
  lines.push(`Lowest daily profit: ${minProfit}   Lowest daily big tip: ${minBigTip}`);
  for (const id of REGULAR_IDS) {
    const found = results.flatMap((r) => {
      const d = r.regulars[id]?.unlockDay;
      return d === null || d === undefined ? [] : [d];
    });
    const hearts = results.map((r) => r.regulars[id]?.hearts ?? 0);
    lines.push(
      `${regularDef(id).name} unlocked: ${found.length}/${results.length} seeds, ` +
        `mean day ${found.length ? mean(found).toFixed(1) : '-'} ` +
        `(per seed: ${fmt(results.map((r) => r.regulars[id]?.unlockDay ?? null))}); ` +
        `mean hearts at end ${mean(hearts).toFixed(1)}`,
    );
  }
  const mix = { solo: 0, couple: 0, friends: 0, family: 0 };
  for (const r of results) for (const k of Object.keys(mix) as PartyKind[]) mix[k] += r.mix[k];
  const parties = Object.values(mix).reduce((a, b) => a + b, 0);
  const kids = results.reduce((n, r) => n + r.kids, 0);
  lines.push(
    `Party mix over ${results.length} runs (${parties} parties, ${(kids / Math.max(1, parties)).toFixed(2)} kids per party): ` +
      (Object.keys(mix) as PartyKind[])
        .map((k) => `${k} ${((mix[k] / Math.max(1, parties)) * 100).toFixed(0)}%`)
        .join(', '),
  );
  lines.push(
    `Recipe price table: ${RECIPE_IDS.map((id) => `${id}=${RECIPES[id].price}`).join(' ')}`,
  );
  return lines.join('\n');
}
