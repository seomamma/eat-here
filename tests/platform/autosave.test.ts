import { describe, expect, it } from 'vitest';
import { bindAutosave } from '../../src/platform/autosave';
import {
  loadSave,
  type SaveSlot,
  type SaveStorage,
  type WriteResult,
} from '../../src/platform/storage';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { findFreeSpot } from '../../src/sim/systems/build';

class CountingStorage implements SaveStorage {
  slots = new Map<SaveSlot, string>();
  writes = 0;
  fail = false;
  load(slot: SaveSlot) {
    return this.slots.get(slot) ?? null;
  }
  save(slot: SaveSlot, text: string): WriteResult {
    if (this.fail) return { ok: false, reason: 'quota' };
    if (slot === 'main') this.writes++;
    this.slots.set(slot, text);
    return { ok: true };
  }
  remove(slot: SaveSlot) {
    this.slots.delete(slot);
  }
}

function setup() {
  const game = new Game(createInitialState(3));
  const storage = new CountingStorage();
  const doc = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible' });
  const win = new EventTarget();
  const queue: (() => void)[] = [];
  const errors: string[] = [];
  const auto = bindAutosave(game, storage, {
    doc: doc as unknown as Document,
    win: win as unknown as Window,
    now: () => 42,
    defer: (fn) => queue.push(fn),
    onError: (r) => errors.push(r),
  });
  const flush = () => queue.splice(0).forEach((fn) => fn());
  return { game, storage, doc, win, auto, flush, errors };
}

describe('autosave', () => {
  it('writes once per in-game hour, not per minute', () => {
    const { game, storage, flush } = setup();
    // 10:00 -> 12:00 is 2 hours = 200 game minutes... run 2.5 hours of ticks.
    for (let i = 0; i < 1000; i++) {
      game.tickOnce();
      flush();
    }
    const hours = Math.floor(game.state.clock.minuteOfDay / 60) - 10;
    expect(hours).toBeGreaterThanOrEqual(2);
    expect(storage.writes).toBe(hours);
  });

  it('merges several triggers in the same tick into one write', () => {
    const { game, storage, flush } = setup();
    const spot = findFreeSpot(game.state, 'plant_potted');
    if (!spot) throw new Error('no spot');
    game.state.money = 1000;
    game.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...spot, rot: 0 });
    game.events.emit('recipeLeveledUp', { recipeId: 'margherita', level: 2 });
    game.events.emit('dayStarted', { day: 2 });
    expect(storage.writes).toBe(0);
    flush();
    expect(storage.writes).toBe(1);
    expect(loadSave(storage)?.state.furniture.some((f) => f.defId === 'plant_potted')).toBe(true);
    expect(loadSave(storage)?.savedAt).toBe(42);
  });

  it('saves a market buy (inventory change) and a furniture move', () => {
    const { game, storage, flush } = setup();
    game.events.emit('inventoryChanged', { ingredient: 'basil_fresh' as never, count: 1 });
    flush();
    game.events.emit('furnitureMoved', { id: 'f1', x: 1, y: 1, rot: 0 });
    flush();
    expect(storage.writes).toBe(2);
  });

  it('saves immediately when the page is hidden or pagehide fires', () => {
    const { storage, doc, win } = setup();
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.writes).toBe(0);
    doc.hidden = true;
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.writes).toBe(1);
    win.dispatchEvent(new Event('pagehide'));
    expect(storage.writes).toBe(2);
  });

  it('an immediate save cancels the pending deferred one', () => {
    const { game, storage, doc, flush } = setup();
    game.events.emit('dayStarted', { day: 2 });
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    flush();
    expect(storage.writes).toBe(1);
  });

  it('reports a failed write and keeps running', () => {
    const { game, storage, flush, errors } = setup();
    storage.fail = true;
    game.events.emit('dayStarted', { day: 2 });
    expect(() => flush()).not.toThrow();
    expect(errors).toEqual(['quota']);
  });

  it('stops after dispose', () => {
    const { game, storage, auto, flush, win } = setup();
    auto.dispose();
    game.events.emit('dayStarted', { day: 2 });
    win.dispatchEvent(new Event('pagehide'));
    flush();
    expect(storage.writes).toBe(0);
  });
});
