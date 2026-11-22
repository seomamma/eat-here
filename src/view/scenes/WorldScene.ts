import Phaser from 'phaser';
import type { GameState } from '../../sim/state';
import { CameraController } from '../CameraController';
import { generatePlaceholderTextures } from '../placeholderTextures';
import { WorldRenderer } from '../WorldRenderer';

const CANVAS_COLOR = 0xf6f3ee;

export class WorldScene extends Phaser.Scene {
  private state!: GameState;

  constructor() {
    super('WorldScene');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CANVAS_COLOR);
    generatePlaceholderTextures(this.textures);
    const renderer = new WorldRenderer(this);
    renderer.sync(this.state);
    new CameraController(this, WorldRenderer.worldSize(this.state));
  }
}
