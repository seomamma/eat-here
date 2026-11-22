import { DEBUG_WALKER_SPEED, TICK_MS } from '../data/balance';
import type { TilePos } from './pathfinding';

/**
 * Screen-facing of a character in the isometric view. +x on the grid goes down-right on screen,
 * +y down-left, -x up-left, -y up-right.
 */
export type IsoDir = 'dr' | 'dl' | 'ur' | 'ul';

export interface Character {
  id: string;
  kind: 'debug';
  /** Position in tile units; integer values are tile centres. Only axis-aligned movement. */
  x: number;
  y: number;
  /** Position at the start of the latest tick (render interpolates prev -> current). */
  prevX: number;
  prevY: number;
  /** Tiles still to visit, in order. Empty = standing still. */
  path: TilePos[];
  dir: IsoDir;
}

const TICK_S = TICK_MS / 1000;

export function dirFromStep(dx: number, dy: number, fallback: IsoDir): IsoDir {
  if (dx > 0) return 'dr';
  if (dx < 0) return 'ul';
  if (dy > 0) return 'dl';
  if (dy < 0) return 'ur';
  return fallback;
}

/** Advances one character by one tick along its path. Returns true when it arrived this tick. */
export function stepCharacter(c: Character, speed: number = DEBUG_WALKER_SPEED): boolean {
  c.prevX = c.x;
  c.prevY = c.y;
  if (c.path.length === 0) return false;
  let dist = speed * TICK_S;
  while (dist > 0 && c.path.length > 0) {
    const target = c.path[0] as TilePos;
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d > 0) c.dir = dirFromStep(dx, dy, c.dir);
    if (d <= dist) {
      c.x = target.x;
      c.y = target.y;
      dist -= d;
      c.path.shift();
    } else {
      c.x += Math.sign(dx) * dist;
      c.y += Math.sign(dy) * dist;
      dist = 0;
    }
  }
  return c.path.length === 0;
}
