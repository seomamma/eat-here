import { describe, expect, it } from 'vitest';
import {
  LocalSaveStorage,
  loadSave,
  wipeSaves,
  writeSave,
  type SaveSlot,
  type SaveStorage,
  type StorageLike,
  type WriteResult,
} from '../../src/platform/storage';
import { serialize } from '../../src/sim/save';
import { createInitialState } from '../../src/sim/state';

class MemoryStorage implements SaveStorage {
  slots = new Map<SaveSlot, string>();
  failWrites: 'quota' | 'unavailable' | null = null;
  load(slot: SaveSlot) {
    return this.slots.get(slot) ?? null;
  }
  save(slot: SaveSlot, text: string): WriteResult {
    if (this.failWrites) return { ok: false, reason: this.failWrites };
    this.slots.set(slot, text);
    return { ok: true };
  }
  remove(slot: SaveSlot) {
    this.slots.delete(slot);
  }
}

const stateWithMoney = (money: number) => ({ ...createInitialState(1), money });
const moneyOf = (s: SaveStorage) => loadSave(s)?.state.money;

describe('writeSave / loadSave', () => {
  it('returns null without any save', () => {
    expect(loadSave(new MemoryStorage())).toBeNull();
  });

  it('keeps the previous good save in backup', () => {
    const s = new MemoryStorage();
    writeSave(s, stateWithMoney(100), 1);
    expect(s.load('backup')).toBeNull();
    writeSave(s, stateWithMoney(200), 2);
    const main = loadSave(s);
    expect(main?.state.money).toBe(200);
    expect(main?.fromBackup).toBe(false);
    expect(main?.savedAt).toBe(2);
    expect(s.load('backup')).toBe(serialize(stateWithMoney(100), 1));
  });

  it('falls back to backup when main is corrupt, and flags it', () => {
    const s = new MemoryStorage();
    writeSave(s, stateWithMoney(100), 1);
    writeSave(s, stateWithMoney(200), 2);
    s.slots.set('main', '{"format":"eat-here-save","vers');
    const res = loadSave(s);
    expect(res?.state.money).toBe(100);
    expect(res?.fromBackup).toBe(true);
  });

  it('does not overwrite a good backup with a corrupt main', () => {
    const s = new MemoryStorage();
    writeSave(s, stateWithMoney(100), 1);
    writeSave(s, stateWithMoney(200), 2);
    s.slots.set('main', 'garbage');
    writeSave(s, stateWithMoney(300), 3);
    expect(s.load('backup')).toBe(serialize(stateWithMoney(100), 1));
    expect(moneyOf(s)).toBe(300);
  });

  it('treats two corrupt slots as no save', () => {
    const s = new MemoryStorage();
    s.slots.set('main', 'nope');
    s.slots.set('backup', '{"format":"eat-here-save","version":1,"state":{}}');
    expect(loadSave(s)).toBeNull();
  });

  it('reports a failing write instead of throwing', () => {
    const s = new MemoryStorage();
    writeSave(s, stateWithMoney(100), 1);
    s.failWrites = 'quota';
    expect(writeSave(s, stateWithMoney(200), 2)).toEqual({ ok: false, reason: 'quota' });
    expect(moneyOf(s)).toBe(100);
  });

  it('wipes both slots', () => {
    const s = new MemoryStorage();
    writeSave(s, stateWithMoney(1), 1);
    writeSave(s, stateWithMoney(2), 2);
    wipeSaves(s);
    expect(loadSave(s)).toBeNull();
  });
});

describe('LocalSaveStorage', () => {
  const fake = (over: Partial<StorageLike> = {}): StorageLike & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
      ...over,
    };
  };

  it('stores slots under separate keys', () => {
    const b = fake();
    const s = new LocalSaveStorage(b);
    expect(s.save('main', 'a')).toEqual({ ok: true });
    s.save('backup', 'b');
    expect(s.load('main')).toBe('a');
    expect(s.load('backup')).toBe('b');
    s.remove('main');
    expect(s.load('main')).toBeNull();
    expect(b.data.size).toBe(1);
  });

  it('never throws: quota, blocked reads, blocked removes', () => {
    const boom = (name: string) => () => {
      const e = new Error('nope');
      e.name = name;
      throw e;
    };
    const quota = new LocalSaveStorage(fake({ setItem: boom('QuotaExceededError') }));
    expect(quota.save('main', 'x')).toEqual({ ok: false, reason: 'quota' });
    const blocked = new LocalSaveStorage(
      fake({
        setItem: boom('SecurityError'),
        getItem: boom('SecurityError'),
        removeItem: boom('X'),
      }),
    );
    expect(blocked.save('main', 'x')).toEqual({ ok: false, reason: 'unavailable' });
    expect(blocked.load('main')).toBeNull();
    expect(() => blocked.remove('main')).not.toThrow();
  });

  it('is unavailable (not a crash) when localStorage does not exist', () => {
    const s = new LocalSaveStorage();
    expect(s.load('main')).toBeNull();
    expect(s.save('main', 'x')).toEqual({ ok: false, reason: 'unavailable' });
  });
});
