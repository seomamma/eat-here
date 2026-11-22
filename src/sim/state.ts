import { DEFAULT_SEED } from '../data/balance';
import { DOOR_X } from '../data/layout';
import type { Character } from './characters';
import { createGrid, createStartFurniture, type Furniture, type GridState } from './grid';
import { buildWalkGrid, isWalkable } from './pathfinding';

export interface GameState {
  version: number;
  /** Initial seed (kept for reproducing a run). */
  seed: number;
  /** Live RNG state (mulberry32), advanced by every random decision. */
  rng: number;
  /** Ticks simulated so far. */
  tick: number;
  money: number;
  day: number;
  grid: GridState;
  furniture: Furniture[];
  characters: Character[];
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

export function createInitialState(seed: number = DEFAULT_SEED): GameState {
  const grid = createGrid();
  const furniture = createStartFurniture();
  const s = spawnTile(grid, furniture);
  return {
    version: 1,
    seed,
    rng: seed >>> 0,
    tick: 0,
    money: 300,
    day: 1,
    grid,
    furniture,
    characters: [
      {
        id: 'debug1',
        kind: 'debug',
        x: s.x,
        y: s.y,
        prevX: s.x,
        prevY: s.y,
        path: [],
        dir: 'dr',
      },
    ],
  };
}
