import { deserialize, serialize } from '../sim/save';
import type { GameState } from '../sim/state';

export type SaveSlot = 'main' | 'backup';

export type WriteResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

/** Where save text lives. Implementations must never throw. */
export interface SaveStorage {
  /** The stored text, or null when the slot is empty or storage is unavailable. */
  load(slot: SaveSlot): string | null;
  save(slot: SaveSlot, text: string): WriteResult;
  remove(slot: SaveSlot): void;
}

const KEY_PREFIX = 'eat-here:save:';

/** Minimal part of `Storage` we use (lets tests pass a fake). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `localStorage` backed storage; every access is wrapped because browsers may block it. */
export class LocalSaveStorage implements SaveStorage {
  constructor(private readonly backend?: StorageLike) {}

  private get store(): StorageLike | null {
    try {
      return this.backend ?? globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  load(slot: SaveSlot): string | null {
    try {
      return this.store?.getItem(KEY_PREFIX + slot) ?? null;
    } catch {
      return null;
    }
  }

  save(slot: SaveSlot, text: string): WriteResult {
    const store = this.store;
    if (!store) return { ok: false, reason: 'unavailable' };
    try {
      store.setItem(KEY_PREFIX + slot, text);
      return { ok: true };
    } catch (e) {
      const quota = e instanceof Error && /quota/i.test(`${e.name} ${e.message}`);
      return { ok: false, reason: quota ? 'quota' : 'unavailable' };
    }
  }

  remove(slot: SaveSlot): void {
    try {
      this.store?.removeItem(KEY_PREFIX + slot);
    } catch {
      /* nothing to do */
    }
  }
}

export interface SaveSummary {
  state: GameState;
  savedAt: number;
  /** True when `main` was unreadable and the previous good save was used instead. */
  fromBackup: boolean;
}

/** Loads `main`; if it does not parse or validate, falls back to `backup`; else null. */
export function loadSave(storage: SaveStorage): SaveSummary | null {
  for (const slot of ['main', 'backup'] as const) {
    const text = storage.load(slot);
    if (text === null) continue;
    const res = deserialize(text);
    if (res.ok) return { state: res.state, savedAt: res.savedAt, fromBackup: slot === 'backup' };
  }
  return null;
}

/**
 * Writes the state to `main` after copying the current `main` to `backup` (so backup is the
 * previous good save). A `main` that no longer validates is never copied over a good backup.
 */
export function writeSave(storage: SaveStorage, state: GameState, now: number): WriteResult {
  const previous = storage.load('main');
  if (previous !== null && deserialize(previous).ok) storage.save('backup', previous);
  return storage.save('main', serialize(state, now));
}

export function wipeSaves(storage: SaveStorage): void {
  storage.remove('main');
  storage.remove('backup');
}
