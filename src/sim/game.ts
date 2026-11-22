import { MAX_TICKS_PER_UPDATE, TICK_MS } from '../data/balance';
import { FURNITURE, type FurnitureDefId, type Rot } from '../data/furniture';
import { createDayStats, recordLedger } from './dayStats';
import { isGuest, isStaff, stepCharacter } from './characters';
import { Emitter, type GameEvents } from './events';
import { buildWalkGrid, findPath, isWalkable, type WalkGrid } from './pathfinding';
import type { GameState } from './state';
import { validateBuy, validateMove } from './systems/build';
import { addIngredient, rollMarket, validateBuyOffer } from './systems/market';
import { nextUpgrade, validateUpgrade } from './systems/recipes';
import type { RecipeId } from '../data/recipes';
import type { FloorStyleId, WallStyleId } from '../data/surfaces';
import { validateSell, validateUpgradeFurniture } from './systems/facilities';
import {
  setFloorStyle,
  setWallStyle,
  validatePaintFloor,
  validatePaintWall,
} from './systems/surfaces';
import { checkMoments } from './systems/moments';
import { replanAfterBuild } from './systems/replan';
import { tickGuests } from './systems/guests';
import { FIRST_GUEST_TICKS } from './systems/spawner';
import { tickStaff } from './systems/staff';
import { DAY_TICKS, NIGHT_TICKS, minuteAtTick, resetClockForDay, type DayPhase } from './time';

export type Command =
  | { type: 'debugWalkTo'; x: number; y: number }
  | { type: 'continueAfterReport' }
  | { type: 'buyAndPlace'; defId: FurnitureDefId; x: number; y: number; rot: Rot }
  | { type: 'moveFurniture'; id: string; x: number; y: number; rot: Rot }
  | { type: 'buyMarketOffer'; index: number }
  | { type: 'upgradeRecipe'; recipeId: RecipeId }
  | { type: 'upgradeFurniture'; id: string }
  | { type: 'sellFurniture'; id: string }
  | { type: 'paintFloor'; tiles: { x: number; y: number }[]; style: FloorStyleId }
  | { type: 'paintWall'; segments: string[]; style: WallStyleId };

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
      const tick = this.state.tick;
      recordLedger(stats, tick, 'dish', e.price);
      if (e.tip > 0)
        recordLedger(stats, tick, 'tip', e.tip, guest && isGuest(guest) ? guest.name : 'guest');
      const recipeId = guest && isGuest(guest) ? guest.recipeId : null;
      if (recipeId) stats.ordersByRecipe[recipeId] = (stats.ordersByRecipe[recipeId] ?? 0) + 1;
    });
    this.events.on('ingredientsBought', (e) => {
      this.state.dayStats.ingredientCosts += e.amount;
      recordLedger(this.state.dayStats, this.state.tick, 'ingredients', -e.amount);
    });
    this.events.on('errandDone', (e) => {
      if (e.kind !== 'vending' || e.coins <= 0) return;
      this.state.dayStats.income += e.coins;
      recordLedger(this.state.dayStats, this.state.tick, 'vending', e.coins);
    });
    this.events.on('giftReceived', () => {
      this.state.dayStats.gifts++;
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

  /** Advances the day clock: open -> closing -> report (waits for the player) -> night -> open. */
  private tickClock(): void {
    const { clock } = this.state;
    if (clock.phase === 'night') {
      if (--clock.nightTicks <= 0) this.startDay(clock.day + 1);
      return;
    }
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

  /** Morning: clock at opening time, fresh day stats, guests start arriving again. */
  private startDay(day: number): void {
    const { clock, guestSpawn } = this.state;
    resetClockForDay(clock, day);
    this.state.dayStats = createDayStats();
    this.state.market = rollMarket(this.state, day);
    guestSpawn.enabled = true;
    guestSpawn.nextInTicks = FIRST_GUEST_TICKS;
    this.setPhase('open');
    this.events.emit('marketRefreshed', { day });
    this.events.emit('dayStarted', { day });
    checkMoments(this.state, this.events);
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
      case 'continueAfterReport':
        return this.continueAfterReport();
      case 'buyAndPlace':
        return this.buyAndPlace(cmd.defId, cmd.x, cmd.y, cmd.rot);
      case 'moveFurniture':
        return this.moveFurniture(cmd.id, cmd.x, cmd.y, cmd.rot);
      case 'buyMarketOffer':
        return this.buyMarketOffer(cmd.index);
      case 'upgradeRecipe':
        return this.upgradeRecipe(cmd.recipeId);
      case 'upgradeFurniture':
        return this.upgradeFurniture(cmd.id);
      case 'sellFurniture':
        return this.sellFurniture(cmd.id);
      case 'paintFloor':
        return this.paintFloor(cmd.tiles, cmd.style);
      case 'paintWall':
        return this.paintWall(cmd.segments, cmd.style);
    }
  }

  /** After any furniture change: rebuild the walk grid and re-plan every affected walk. */
  private afterFurnitureChange(): void {
    this.invalidateWalkGrid();
    replanAfterBuild({ state: this.state, walk: this.walk(), events: this.events });
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
    recordLedger(state.dayStats, state.tick, 'furniture', -price, defId);
    state.furniture.push({ id, defId, x, y, rot, level: 1 });
    this.afterFurnitureChange();
    this.events.emit('moneyChanged', { money: state.money });
    this.events.emit('furniturePlaced', { id, defId, x, y, rot });
    return { ok: true };
  }

  private moveFurniture(id: string, x: number, y: number, rot: Rot): CommandResult {
    const check = validateMove(this.state, id, x, y, rot);
    if (!check.ok) return check;
    const piece = this.state.furniture.find((f) => f.id === id);
    if (!piece) return { ok: false, reason: 'unknownFurniture' };
    piece.x = x;
    piece.y = y;
    piece.rot = rot;
    this.afterFurnitureChange();
    this.events.emit('furnitureMoved', { id, x, y, rot });
    return { ok: true };
  }

  private upgradeFurniture(id: string): CommandResult {
    const { state } = this;
    const check = validateUpgradeFurniture(state, id);
    if (!check.ok) return check;
    const piece = state.furniture.find((f) => f.id === id);
    if (!piece) return { ok: false, reason: 'unknownFurniture' };
    state.money -= check.cost;
    piece.level++;
    recordLedger(
      state.dayStats,
      state.tick,
      'upgrade',
      -check.cost,
      `${piece.defId}:${piece.level}`,
    );
    this.events.emit('moneyChanged', { money: state.money });
    this.events.emit('furnitureLeveledUp', { id, defId: piece.defId, level: piece.level });
    return { ok: true };
  }

  private sellFurniture(id: string): CommandResult {
    const { state } = this;
    const check = validateSell(state, id);
    if (!check.ok) return check;
    const piece = state.furniture.find((f) => f.id === id);
    if (!piece) return { ok: false, reason: 'unknownFurniture' };
    state.furniture = state.furniture.filter((f) => f.id !== id);
    state.money += check.refund;
    recordLedger(state.dayStats, state.tick, 'sale', check.refund, piece.defId);
    this.afterFurnitureChange();
    this.events.emit('moneyChanged', { money: state.money });
    this.events.emit('furnitureSold', { id, defId: piece.defId, refund: check.refund });
    return { ok: true };
  }

  private paintFloor(tiles: { x: number; y: number }[], style: FloorStyleId): CommandResult {
    const { state } = this;
    const check = validatePaintFloor(state, tiles, style);
    if (!check.ok) return check;
    for (const t of tiles) setFloorStyle(state, t.x, t.y, style);
    this.finishPaint('floor', `floor:${style}`, check.cost, check.changed);
    return { ok: true };
  }

  private paintWall(segments: string[], style: WallStyleId): CommandResult {
    const { state } = this;
    const check = validatePaintWall(state, segments, style);
    if (!check.ok) return check;
    for (const id of segments) setWallStyle(state, id, style);
    this.finishPaint('wall', `wall:${style}`, check.cost, check.changed);
    return { ok: true };
  }

  private finishPaint(target: 'floor' | 'wall', label: string, cost: number, count: number): void {
    const { state } = this;
    state.money -= cost;
    recordLedger(state.dayStats, state.tick, 'furniture', -cost, label, count);
    this.events.emit('moneyChanged', { money: state.money });
    this.events.emit('surfacePainted', { target, count, cost });
  }

  private buyMarketOffer(index: number): CommandResult {
    const { state } = this;
    const check = validateBuyOffer({ phase: state.clock.phase, ...state }, index);
    if (!check.ok) return check;
    const offer = state.market.offers[index];
    if (!offer) return { ok: false, reason: 'unknownOffer' };
    offer.bought = true;
    state.money -= offer.price;
    recordLedger(state.dayStats, state.tick, 'market', -offer.price, offer.ingredient);
    this.events.emit('moneyChanged', { money: state.money });
    addIngredient(state, this.events, offer.ingredient);
    return { ok: true };
  }

  private upgradeRecipe(recipeId: RecipeId): CommandResult {
    const { state } = this;
    const check = validateUpgrade({ phase: state.clock.phase, ...state }, recipeId);
    if (!check.ok) return check;
    const recipe = state.recipes[recipeId];
    const up = nextUpgrade(recipeId, recipe.level);
    if (!up) return { ok: false, reason: 'maxLevel' };
    state.money -= up.coins;
    recordLedger(state.dayStats, state.tick, 'upgrade', -up.coins, `${recipeId}:${up.level}`);
    recipe.level = up.level;
    this.events.emit('moneyChanged', { money: state.money });
    if (up.ingredient) {
      state.inventory[up.ingredient]--;
      this.events.emit('inventoryChanged', {
        ingredient: up.ingredient,
        count: state.inventory[up.ingredient],
      });
    }
    this.events.emit('recipeLeveledUp', { recipeId, level: recipe.level });
    checkMoments(state, this.events);
    return { ok: true };
  }

  private continueAfterReport(): CommandResult {
    const { clock } = this.state;
    if (clock.phase !== 'report') return { ok: false, reason: 'not_in_report' };
    clock.nightTicks = NIGHT_TICKS;
    this.setPhase('night');
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
