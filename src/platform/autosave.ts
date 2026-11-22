import type { Game } from '../sim/game';
import { writeSave, type SaveStorage, type WriteResult } from './storage';

export interface Autosave {
  /** Writes right now (also cancels a pending debounced write). */
  saveNow(): WriteResult;
  dispose(): void;
}

export interface AutosaveOptions {
  doc?: Document;
  win?: Window;
  /** Wall clock for `savedAt`. */
  now?: () => number;
  /** Runs `fn` after the current synchronous work (default: microtask). */
  defer?: (fn: () => void) => void;
  /** Called when a write fails (quota, blocked storage). */
  onError?: (reason: 'quota' | 'unavailable') => void;
}

/**
 * Autosave (D-032), driven by sim events so the sim itself stays pure: every in-game hour and
 * phase change, after purchases, moves and upgrades, at day start, and at once when the page is
 * hidden. Triggers in the same tick (or frame) are merged into one write.
 */
export function bindAutosave(
  game: Game,
  storage: SaveStorage,
  opts: AutosaveOptions = {},
): Autosave {
  const doc = opts.doc ?? document;
  const win = opts.win ?? window;
  const now = opts.now ?? Date.now;
  const defer = opts.defer ?? ((fn) => queueMicrotask(fn));
  let pending = false;
  let lastHour = Math.floor(game.state.clock.minuteOfDay / 60);

  const saveNow = (): WriteResult => {
    pending = false;
    const res = writeSave(storage, game.state, now());
    if (!res.ok) opts.onError?.(res.reason);
    return res;
  };
  const request = (): void => {
    if (pending) return;
    pending = true;
    defer(() => {
      if (pending) saveNow();
    });
  };
  const flush = (): void => {
    saveNow();
  };
  const onVisibility = (): void => {
    if (doc.hidden || doc.visibilityState === 'hidden') flush();
  };

  const offs = [
    game.events.on('clockChanged', (e) => {
      const hour = Math.floor(e.minuteOfDay / 60);
      if (hour !== lastHour) {
        lastHour = hour;
        request();
      }
    }),
    game.events.on('phaseChanged', request),
    game.events.on('dayStarted', request),
    game.events.on('furniturePlaced', request),
    game.events.on('furnitureMoved', request),
    game.events.on('recipeLeveledUp', request),
    // Market buys change money and the offer list but emit only these two events.
    game.events.on('inventoryChanged', request),
  ];
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', flush);

  return {
    saveNow,
    dispose() {
      offs.forEach((off) => off());
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', flush);
    },
  };
}
