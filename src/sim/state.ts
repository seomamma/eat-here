import { DEFAULT_SEED } from '../data/balance';
import type { IngredientId } from '../data/ingredients';
import { RECIPE_IDS, RECIPES, type RecipeId } from '../data/recipes';
import { DOOR_X, START_STAFF } from '../data/layout';
import type { Character, Staff } from './characters';
import type { Job, Order } from './systems/jobs';
import { createGrid, createStartFurniture, type Furniture, type GridState } from './grid';
import { createDayStats, type DayStats } from './dayStats';
import { SAVE_VERSION } from './save';
import { createClock, type Clock } from './time';
import { buildWalkGrid, isWalkable } from './pathfinding';
import { createInventory, rollMarket, type MarketState } from './systems/market';
import { FIRST_GUEST_TICKS } from './systems/spawner';

export interface GameState {
  version: number;
  /** Initial seed (kept for reproducing a run). */
  seed: number;
  /** Live RNG state (mulberry32), advanced by every random decision. */
  rng: number;
  /** Ticks simulated so far. */
  tick: number;
  money: number;
  /** Total spent on furniture (not part of any day's income or costs). */
  spentOnBuilding: number;
  fame: number;
  /** Restaurant rank, 1-based (src/data/ranks.ts). */
  rank: number;
  clock: Clock;
  /** Numbers of the current day; reset when the next day starts. */
  dayStats: DayStats;
  grid: GridState;
  furniture: Furniture[];
  characters: Character[];
  /** Open jobs for staff (oldest first). */
  jobs: Job[];
  /** Orders in flight (removed once served or discarded). */
  orders: Order[];
  recipes: Record<RecipeId, { unlocked: boolean; level: number }>;
  /** Special upgrade ingredients owned (D-031). */
  inventory: Record<IngredientId, number>;
  /** Today's market offers. */
  market: MarketState;
  guestSpawn: {
    /** True while the restaurant admits guests (open phase). */
    enabled: boolean;
    /** Ticks until the next arrival. */
    nextInTicks: number;
  };
  /** Counter for guest ids. */
  nextGuestId: number;
  nextFurnitureId: number;
  nextJobId: number;
  nextOrderId: number;
}

/** Nearest free floor tile to the door (just inside the room). */
function spawnTile(grid: GridState, furniture: Furniture[]): { x: number; y: number } {
  const walk = buildWalkGrid(grid, furniture);
  let best = { x: DOOR_X, y: grid.height - 2 };
  let bestD = Infinity;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!isWalkable(walk, x, y) || (x === DOOR_X && y === grid.height - 1)) continue;
      const d = Math.abs(x - DOOR_X) + Math.abs(y - (grid.height - 1));
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

export function createRecipes(): GameState['recipes'] {
  const out = {} as GameState['recipes'];
  for (const id of RECIPE_IDS) out[id] = { unlocked: RECIPES[id].unlock === 'start', level: 1 };
  return out;
}

export interface InitialStateOptions {
  /** Adds the tap-to-walk debug walker (?debug). Off by default. */
  debugWalker?: boolean;
}

export function createInitialState(
  seed: number = DEFAULT_SEED,
  opts: InitialStateOptions = {},
): GameState {
  const grid = createGrid();
  const furniture = createStartFurniture();
  const s = spawnTile(grid, furniture);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed >>> 0,
    tick: 0,
    money: 300,
    spentOnBuilding: 0,
    fame: 0,
    rank: 1,
    clock: createClock(),
    dayStats: createDayStats(),
    grid,
    furniture,
    characters: [...(opts.debugWalker ? [debugWalker(s)] : []), ...createStaff()],
    jobs: [],
    orders: [],
    recipes: createRecipes(),
    guestSpawn: { enabled: true, nextInTicks: FIRST_GUEST_TICKS },
    nextGuestId: 1,
    nextFurnitureId: furniture.length + 1,
    nextJobId: 1,
    nextOrderId: 1,
    inventory: createInventory(),
    market: { day: 1, offers: [] },
  };
  state.market = rollMarket(state, 1);
  return state;
}

function createStaff(): Staff[] {
  return START_STAFF.map((p, i) => ({
    id: `staff${i + 1}`,
    kind: 'staff',
    role: p.role,
    level: 1,
    xp: 0,
    phase: 'idle',
    jobId: null,
    stage: '',
    target: null,
    action: null,
    timer: 0,
    carrying: null,
    home: { x: p.x, y: p.y },
    x: p.x,
    y: p.y,
    prevX: p.x,
    prevY: p.y,
    path: [],
    dir: 'dr',
  }));
}

function debugWalker(s: { x: number; y: number }): Character {
  return {
    id: 'debug1',
    kind: 'debug',
    x: s.x,
    y: s.y,
    prevX: s.x,
    prevY: s.y,
    path: [],
    dir: 'dr',
  };
}
