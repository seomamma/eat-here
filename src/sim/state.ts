import { createGrid, createStartFurniture, type Furniture, type GridState } from './grid';

export interface GameState {
  version: number;
  money: number;
  day: number;
  grid: GridState;
  furniture: Furniture[];
}

export function createInitialState(): GameState {
  return {
    version: 1,
    money: 300,
    day: 1,
    grid: createGrid(),
    furniture: createStartFurniture(),
  };
}
