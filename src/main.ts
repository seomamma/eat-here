import Phaser from 'phaser';
import { render, h } from 'preact';
import { Game } from './sim/game';
import { createInitialState } from './sim/state';
import { attachDeviceCanvas, deviceCanvasSize } from './view/deviceCanvas';
import { WorldScene } from './view/scenes/WorldScene';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/components.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';

const sim = new Game(createInitialState());

// Dev hook for automated checks: add ?debug to the URL.
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __sim: Game }).__sim = sim;
}

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

const ui = document.getElementById('ui');
if (!ui) throw new Error('#ui container missing');
render(h(App, {}), ui);
