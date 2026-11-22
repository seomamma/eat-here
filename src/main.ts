import Phaser from 'phaser';
import { render, h } from 'preact';
import { bindAutosave } from './platform/autosave';
import { AudioEngine } from './platform/audio';
import { bindAudioEvents } from './platform/audioEvents';
import { bindLifecycle } from './platform/lifecycle';
import { randomSeed } from './platform/seed';
import { LocalSaveStorage, loadSave, wipeSaves, writeSave } from './platform/storage';
import { Game } from './sim/game';
import { createInitialState, type GameState } from './sim/state';
import { attachDeviceCanvas, deviceCanvasSize } from './view/deviceCanvas';
import { WorldScene } from './view/scenes/WorldScene';
import { App } from './ui/App';
import { bindBuild } from './ui/build';
import { rankDef } from './data/ranks';
import { STRINGS } from './data/strings';
import { sessionActions, settings } from './ui/settings';
import { bindStore, pushToast, screen, titleMenu } from './ui/store';
import './ui/styles/tokens.css';
import './ui/styles/components.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';

// Dev hook for automated checks: add ?debug to the URL (also adds the tap-to-walk debug walker
// and the __sim / __save / __load / __wipe helpers).
const debug = new URLSearchParams(location.search).has('debug');
const storage = new LocalSaveStorage();
const found = loadSave(storage);

const ui = document.getElementById('ui');
if (!ui) throw new Error('#ui container missing');

// Audio (M10): procedural Web Audio. The context is created on the first user gesture (mobile
// autoplay rules), follows the Settings toggles and stops while the page is hidden.
const audio = new AudioEngine(settings.value);
settings.subscribe((s) => audio.applySettings(s));
for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  else audio.resume();
});
// A small pop on every button tap in the UI overlay.
ui.addEventListener('click', (e) => {
  if (e.target instanceof Element && e.target.closest('button')) audio.play('pop');
});

/** Boots the sim, store, autosave and Phaser world for a state (new or loaded). */
function startGame(state: GameState, fromBackup: boolean): void {
  const sim = new Game(state);
  bindStore(sim);
  bindBuild(sim);
  bindLifecycle(sim);
  bindAudioEvents(sim, audio);
  const autosave = bindAutosave(sim, storage, {
    onError: () => pushToast({ kind: 'notice', text: STRINGS.notice.saveFailed }),
  });
  // "Back to title": save, then reload. A reload is the simplest way to drop every binding of
  // this session (sim, store, Phaser) and show the title with Continue ready.
  sessionActions.backToTitle = () => {
    autosave.saveNow();
    location.reload();
  };
  if (debug) {
    const w = window as unknown as Record<string, unknown>;
    w.__sim = sim;
    w.__audio = audio;
    w.__save = () => autosave.saveNow();
    // Returns what is in storage (does not swap the running game; reload and Continue for that).
    w.__load = () => loadSave(storage);
    w.__wipe = () => wipeSaves(storage);
  }
  screen.value = 'game';
  if (fromBackup) pushToast({ kind: 'notice', text: STRINGS.notice.restoredBackup });

  const host = document.getElementById('game');
  if (!host) throw new Error('#game container missing');
  const initial = deviceCanvasSize(host);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#F6F3EE',
    pixelArt: true,
    roundPixels: true,
    // Canvas is sized in device pixels and kept in sync by attachDeviceCanvas (D-026).
    scale: { mode: Phaser.Scale.NONE, width: initial.width, height: initial.height },
    scene: [],
  });
  attachDeviceCanvas(game, host);
  game.scene.add('WorldScene', WorldScene, true, { sim });
}

titleMenu.value = {
  save: found
    ? {
        day: found.state.clock.day,
        rankName: rankDef(found.state.rank).name,
        money: found.state.money,
      }
    : null,
  onContinue: () => {
    if (found) startGame(found.state, found.fromBackup);
  },
  onNewGame: () => {
    const state = createInitialState(randomSeed(), { debugWalker: debug });
    // Written at once: the old pizzeria moves to the backup slot, the new one is the main save.
    writeSave(storage, state, Date.now());
    startGame(state, false);
  },
};
render(h(App, {}), ui);
