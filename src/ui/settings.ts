import { signal } from '@preact/signals';
import { loadSettings, saveSettings, type Settings } from '../platform/settings';

/** Player settings (sound toggles). Persisted in localStorage, separately from the save. */
export const settings = signal<Settings>(loadSettings());

export function setSetting(key: keyof Settings, value: boolean): void {
  settings.value = { ...settings.value, [key]: value };
  saveSettings(settings.value);
}

/** Whether the Settings panel is open. */
export const settingsOpen = signal(false);

/** Things the running session lets the UI do; filled in by main when a game starts. */
export const sessionActions: { backToTitle: (() => void) | null } = { backToTitle: null };
