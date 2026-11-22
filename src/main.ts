import Phaser from 'phaser';
import { render, h } from 'preact';
import { WorldScene } from './view/scenes/WorldScene';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/components.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#F6F3EE',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [WorldScene],
});

const ui = document.getElementById('ui');
if (!ui) throw new Error('#ui container missing');
render(h(App, {}), ui);
