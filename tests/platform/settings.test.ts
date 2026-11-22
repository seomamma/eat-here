import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../src/platform/settings';

function fakeStore(initial?: string) {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    peek: () => value,
  };
}

describe('settings persistence', () => {
  it('defaults to sound and music on', () => {
    expect(loadSettings(fakeStore())).toEqual({ sfx: true, music: true });
    expect(DEFAULT_SETTINGS).toEqual({ sfx: true, music: true });
  });

  it('round-trips both toggles', () => {
    const store = fakeStore();
    expect(saveSettings({ sfx: false, music: true }, store)).toBe(true);
    expect(loadSettings(store)).toEqual({ sfx: false, music: true });
    saveSettings({ sfx: true, music: false }, store);
    expect(loadSettings(store)).toEqual({ sfx: true, music: false });
  });

  it('falls back per field on broken or partial data', () => {
    expect(loadSettings(fakeStore('not json'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(fakeStore('null'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(fakeStore('{"sfx":false,"music":"yes"}'))).toEqual({
      sfx: false,
      music: true,
    });
  });

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings({ sfx: false, music: false }, blocked)).toBe(false);
  });

  it('is stored apart from the save keys', () => {
    const store = fakeStore();
    saveSettings({ sfx: false, music: false }, store);
    expect(store.peek()).not.toBeNull();
  });
});
