/** Player settings, stored in localStorage separately from the save (M10). */

export interface Settings {
  sfx: boolean;
  music: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sfx: true, music: true };

const KEY = 'eat-here:settings';

/** Minimal part of `Storage` we use (lets tests pass a fake). */
export type SettingsBackend = Pick<Storage, 'getItem' | 'setItem'>;

function backendOrNull(backend?: SettingsBackend): SettingsBackend | null {
  try {
    return backend ?? globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the settings; anything missing, broken or blocked falls back to the defaults. */
export function loadSettings(backend?: SettingsBackend): Settings {
  try {
    const text = backendOrNull(backend)?.getItem(KEY);
    if (!text) return { ...DEFAULT_SETTINGS };
    const data = JSON.parse(text) as Partial<Record<keyof Settings, unknown>> | null;
    return {
      sfx: typeof data?.sfx === 'boolean' ? data.sfx : DEFAULT_SETTINGS.sfx,
      music: typeof data?.music === 'boolean' ? data.music : DEFAULT_SETTINGS.music,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Writes the settings; returns false when storage is blocked or full (never throws). */
export function saveSettings(settings: Settings, backend?: SettingsBackend): boolean {
  try {
    const store = backendOrNull(backend);
    if (!store) return false;
    store.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
