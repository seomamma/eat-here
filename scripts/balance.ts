/**
 * Headless balance runner (M10): plays N days for several seeds with a simple scripted player
 * and reports money / fame / rank curves. Pure sim, no DOM. Run with `npm run balance`.
 */
import { DECOR_RADIUS } from '../src/data/happiness';
import { FURNITURE } from '../src/data/furniture';
import type { IngredientId } from '../src/data/ingredients';
import { RECIPE_IDS, RECIPES } from '../src/data/recipes';
import { REGULAR_IDS, regularDef } from '../src/data/regulars';
import { isGuest } from '../src/sim/characters';
import { profitOf } from '../src/sim/dayStats';
import { Game } from '../src/sim/game';
import { createInitialState } from '../src/sim/state';
import { validateBuy } from '../src/sim/systems/build';
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
}

export interface RunResult {
  seed: number;
  days: DayRow[];
  /** Day on which rank 2 was reached (null if not within the run). */
  rank2Day: number | null;
  /** Day on which the first plant was bought (null if never). */
  plantDay: number | null;
  /** First day (at its end) any dish had reached Lv.2..5 (null = not within the run). */
  levelDay: Record<number, number | null>;
  /** Day each regular became a regular (null = not within the run), and hearts at the end. */
  regulars: Record<string, { unlockDay: number | null; hearts: number }>;
}

/** Coins the player keeps back for ingredients before spending on anything. */
const RESERVE = 30;
/** Plants are worth 5 appeal each and decor caps at 20 per chair, so 4 are plenty. */
const MAX_PLANTS = 4;
/** How often (ticks) the scripted player looks around while the day runs. */
const THINK_EVERY_TICKS = 50;

/** Plant spot: the free tile with the most chairs within decor range. */
function bestPlantSpot(game: Game): { x: number; y: number } | null {
  const { state } = game;
  const chairs = state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
  let best: { x: number; y: number; score: number } | null = null;
  for (let y = 0; y < state.grid.height; y++) {
    for (let x = 0; x < state.grid.width; x++) {
      if (!validateBuy({ ...state, money: 1e9 }, 'plant_potted', x, y, 0).ok) continue;
      const score = chairs.filter(
        (c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= DECOR_RADIUS,
      ).length;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best;
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

/** One round of the scripted player's decisions. */
function think(game: Game, log: { plantDay: number | null }): void {
  const { state } = game;
  if (state.clock.phase === 'night') return;
  // Upgrade whatever can be upgraded (keeps the reserve).
  for (const id of RECIPE_IDS) {
    const r = state.recipes[id];
    const up = r.unlocked ? nextUpgrade(id, r.level) : null;
    if (up && state.money - up.coins >= RESERVE)
      game.dispatch({ type: 'upgradeRecipe', recipeId: id });
  }
  // Buy a plant when affordable (a few; more only clutter the room).
  const plants = state.furniture.filter((f) => f.defId === 'plant_potted').length;
  if (plants < MAX_PLANTS && state.money >= FURNITURE.plant_potted.price + RESERVE) {
    const spot = bestPlantSpot(game);
    if (spot) {
      const res = game.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...spot, rot: 0 });
      if (res.ok && log.plantDay === null) log.plantDay = state.clock.day;
    }
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
export function runSeed(seed: number, days: number): RunResult {
  const game = new Game(createInitialState(seed));
  const result: RunResult = {
    seed,
    days: [],
    rank2Day: null,
    plantDay: null,
    levelDay: { 2: null, 3: null, 4: null, 5: null },
    regulars: {},
  };
  for (const id of REGULAR_IDS) result.regulars[id] = { unlockDay: null, hearts: 0 };
  const log = { plantDay: null as number | null };
  let happy: number[] = [];
  let arrived = 0;
  let bigTip = 0;
  game.events.on('guestArrived', () => arrived++);
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
  });
  const maxTicks = DAY_TICKS * 3;
  for (let d = 1; d <= days; d++) {
    happy = [];
    arrived = 0;
    bigTip = 0;
    think(game, log);
    for (let i = 0; i < maxTicks && game.state.clock.phase !== 'report'; i++) {
      game.tickOnce();
      if (i % THINK_EVERY_TICKS === 0) think(game, log);
    }
    const stats = game.state.dayStats;
    result.days.push({
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
  lines.push(
    `Recipe price table: ${RECIPE_IDS.map((id) => `${id}=${RECIPES[id].price}`).join(' ')}`,
  );
  return lines.join('\n');
}
