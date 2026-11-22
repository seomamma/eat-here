export interface GameState {
  version: number;
  money: number;
  day: number;
}

export function createInitialState(): GameState {
  return { version: 1, money: 300, day: 1 };
}
