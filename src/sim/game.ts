import { MAX_TICKS_PER_UPDATE, TICK_MS } from '../data/balance';
import { stepCharacter } from './characters';
import { Emitter } from './events';
import { buildWalkGrid, findPath, isWalkable, type WalkGrid } from './pathfinding';
import type { GameState } from './state';

export type Command = { type: 'debugWalkTo'; x: number; y: number };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export interface GameEvents {
  walkerArrived: { id: string };
}

/** Owns GameState, runs fixed ticks and validates commands. Pure TS: no Phaser, no DOM. */
export class Game {
  readonly events = new Emitter<GameEvents>();
  /** Sim speed multiplier applied to real time. */
  speed = 1;
  private accumulator = 0;
  private walkGrid: WalkGrid | null = null;

  constructor(readonly state: GameState) {}

  /** Fraction (0..1) of the way into the next tick, for render interpolation. */
  get alpha(): number {
    return this.accumulator / TICK_MS;
  }

  /** Call when furniture or tiles change so the walkability cache is rebuilt. */
  invalidateWalkGrid(): void {
    this.walkGrid = null;
  }

  private walk(): WalkGrid {
    this.walkGrid ??= buildWalkGrid(this.state.grid, this.state.furniture);
    return this.walkGrid;
  }

  /** Feeds real elapsed time; runs as many fixed ticks as fit (capped). */
  update(realDtMs: number): void {
    if (!(realDtMs > 0)) return;
    this.accumulator += realDtMs * this.speed;
    let n = 0;
    while (this.accumulator >= TICK_MS && n < MAX_TICKS_PER_UPDATE) {
      this.tickOnce();
      this.accumulator -= TICK_MS;
      n++;
    }
    // Over the cap: drop the backlog instead of chasing it.
    if (this.accumulator >= TICK_MS) this.accumulator %= TICK_MS;
  }

  /** Runs exactly one tick (also used directly by tests). */
  tickOnce(): void {
    this.state.tick++;
    for (const c of this.state.characters) {
      if (stepCharacter(c)) this.events.emit('walkerArrived', { id: c.id });
    }
  }

  dispatch(cmd: Command): CommandResult {
    switch (cmd.type) {
      case 'debugWalkTo':
        return this.debugWalkTo(cmd.x, cmd.y);
    }
  }

  private debugWalkTo(x: number, y: number): CommandResult {
    const walker = this.state.characters.find((c) => c.kind === 'debug');
    if (!walker) return { ok: false, reason: 'no_walker' };
    const walk = this.walk();
    if (!isWalkable(walk, x, y)) return { ok: false, reason: 'unreachable' };
    // A walker between tiles must finish the step it is on, so plan from the tile it heads to.
    const next = walker.path[0];
    const from = next ?? { x: Math.round(walker.x), y: Math.round(walker.y) };
    const path = findPath(walk, from, { x, y });
    if (!path) return { ok: false, reason: 'unreachable' };
    walker.path = path;
    return { ok: true };
  }
}
