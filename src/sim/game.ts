import { MAX_TICKS_PER_UPDATE, TICK_MS } from '../data/balance';
import { FURNITURE, type FurnitureDefId, type Rot } from '../data/furniture';
import { createDayStats } from './dayStats';
import { isGuest, isStaff, stepCharacter } from './characters';
import { Emitter, type GameEvents } from './events';
import { buildWalkGrid, findPath, isWalkable, type WalkGrid } from './pathfinding';
import type { GameState } from './state';
import { validateBuy, validatePlacement } from './systems/build';
import { tickGuests } from './systems/guests';
import { FIRST_GUEST_TICKS } from './systems/spawner';
import { tickStaff } from './systems/staff';
import { DAY_TICKS, minuteAtTick, resetClockForDay, type DayPhase } from './time';

export type Command =
  | { type: 'debugWalkTo'; x: number; y: number }
  | { type: 'openRestaurant' }
  | { type: 'continueAfterReport' }
  | { type: 'buyAndPlace'; defId: FurnitureDefId; x: number; y: number; rot: Rot }
  | { type: 'moveFurniture'; id: string; x: number; y: number; rot: Rot };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type { GameEvents };

/** Owns GameState, runs fixed ticks and validates commands. Pure TS: no Phaser, no DOM. */
export class Game {
  readonly events = new Emitter<GameEvents>();
  /** Sim speed multiplier applied to real time. */
  speed = 1;
  private accumulator = 0;
  private walkGrid: WalkGrid | null = null;

  /** Why time is stopped (several can hold at once, e.g. hidden tab and a modal). */
  private readonly pauseReasons = new Set<string>();

  constructor(readonly state: GameState) {
    // Day stats are fed from the sim's own events, so the report always equals what happened.
    this.events.on('paid', (e) => {
      const stats = this.state.dayStats;
      stats.income += e.amount;
      stats.tips += e.tip;
      stats.fameGained += e.fame;
      stats.guestsServed++;
      const guest = this.state.characters.find((c) => c.id === e.guestId);
      const recipeId = guest && isGuest(guest) ? guest.recipeId : null;
      if (recipeId) stats.ordersByRecipe[recipeId] = (stats.ordersByRecipe[recipeId] ?? 0) + 1;
    });
    this.events.on('ingredientsBought', (e) => {
      this.state.dayStats.ingredientCosts += e.amount;
    });
    this.events.on('guestLeft', (e) => {
      if (e.reason === 'noSeat') this.state.dayStats.guestsLeftNoSeat++;
    });
  }

  get isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  /** Stops time (tab hidden, modal open). `update` does nothing until every reason is resumed. */
  pause(reason = 'visibility'): void {
    this.pauseReasons.add(reason);
  }

  /** Continues exactly where it stopped: time that passed while paused is dropped, not replayed. */
  resume(reason = 'visibility'): void {
    this.pauseReasons.delete(reason);
    this.accumulator = 0;
  }

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
    if (this.isPaused || !(realDtMs > 0)) return;
    this.accumulator += realDtMs * this.speed;
    let n = 0;
    // A tick can pause the sim (rank-up modal): stop right there.
    while (this.accumulator >= TICK_MS && n < MAX_TICKS_PER_UPDATE && !this.isPaused) {
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
    const ctx = { state: this.state, walk: this.walk(), events: this.events };
    tickGuests(ctx);
    tickStaff(ctx);
    for (const c of this.state.characters) {
      if (c.kind === 'debug' && stepCharacter(c)) this.events.emit('walkerArrived', { id: c.id });
    }
    this.tickClock();
  }

  private setPhase(phase: DayPhase): void {
    const { clock } = this.state;
    clock.phase = phase;
    this.events.emit('phaseChanged', { day: clock.day, phase });
    this.events.emit('clockChanged', {
      day: clock.day,
      minuteOfDay: clock.minuteOfDay,
      phase,
    });
  }

  /** Advances the day clock (open/closing only) and moves open -> closing -> report. */
  private tickClock(): void {
    const { clock } = this.state;
    if (clock.phase !== 'open' && clock.phase !== 'closing') return;
    const before = Math.floor(clock.minuteOfDay);
    clock.dayTick++;
    clock.minuteOfDay = minuteAtTick(clock.dayTick);
    if (clock.phase === 'open' && clock.dayTick >= DAY_TICKS) {
      this.state.guestSpawn.enabled = false;
      this.setPhase('closing');
    } else if (clock.phase === 'closing' && this.isRestaurantEmpty()) {
      this.setPhase('report');
      this.events.emit('dayEnded', { day: clock.day, stats: structuredClone(this.state.dayStats) });
    } else if (Math.floor(clock.minuteOfDay) !== before) {
      this.events.emit('clockChanged', {
        day: clock.day,
        minuteOfDay: clock.minuteOfDay,
        phase: clock.phase,
      });
    }
  }

  /** No guests, no orders or jobs in flight, and every staff member idle with empty hands. */
  private isRestaurantEmpty(): boolean {
    const { state } = this;
    if (state.jobs.length > 0 || state.orders.length > 0) return false;
    return state.characters.every((c) => {
      if (isGuest(c)) return false;
      if (isStaff(c)) return c.phase === 'idle' && c.carrying === null;
      return true;
    });
  }

  dispatch(cmd: Command): CommandResult {
    switch (cmd.type) {
      case 'debugWalkTo':
        return this.debugWalkTo(cmd.x, cmd.y);
      case 'openRestaurant':
        return this.openRestaurant();
      case 'continueAfterReport':
        return this.continueAfterReport();
      case 'buyAndPlace':
        return this.buyAndPlace(cmd.defId, cmd.x, cmd.y, cmd.rot);
      case 'moveFurniture':
        return this.moveFurniture(cmd.id, cmd.x, cmd.y, cmd.rot);
    }
  }

  /** Buys a shop item and places it in one step; nothing changes unless all checks pass. */
  private buyAndPlace(defId: FurnitureDefId, x: number, y: number, rot: Rot): CommandResult {
    const check = validateBuy(this.state, defId, x, y, rot);
    if (!check.ok) return check;
    const { state } = this;
    const price = FURNITURE[defId].price;
    const id = `f${state.nextFurnitureId++}`;
    state.money -= price;
    state.spentOnBuilding += price;
    state.furniture.push({ id, defId, x, y, rot, level: 1 });
    this.invalidateWalkGrid();
    this.events.emit('moneyChanged', { money: state.money });
    this.events.emit('furniturePlaced', { id, defId, x, y, rot });
    return { ok: true };
  }

  private moveFurniture(id: string, x: number, y: number, rot: Rot): CommandResult {
    const { state } = this;
    if (state.clock.phase !== 'prep') return { ok: false, reason: 'notPrep' };
    const piece = state.furniture.find((f) => f.id === id);
    if (!piece) return { ok: false, reason: 'unknownFurniture' };
    const check = validatePlacement(state, piece.defId, x, y, rot, id);
    if (!check.ok) return check;
    piece.x = x;
    piece.y = y;
    piece.rot = rot;
    this.invalidateWalkGrid();
    this.events.emit('furnitureMoved', { id, x, y, rot });
    return { ok: true };
  }

  private openRestaurant(): CommandResult {
    const { clock, guestSpawn } = this.state;
    if (clock.phase !== 'prep') return { ok: false, reason: 'not_in_prep' };
    resetClockForDay(clock, clock.day);
    guestSpawn.enabled = true;
    guestSpawn.nextInTicks = FIRST_GUEST_TICKS;
    this.setPhase('open');
    return { ok: true };
  }

  private continueAfterReport(): CommandResult {
    const { clock } = this.state;
    if (clock.phase !== 'report') return { ok: false, reason: 'not_in_report' };
    resetClockForDay(clock, clock.day + 1);
    this.state.dayStats = createDayStats();
    this.setPhase('prep');
    return { ok: true };
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
