import Phaser from 'phaser';
import { inBounds } from '../../sim/grid';
import type { GameState } from '../../sim/state';
import { CameraController } from '../CameraController';
import { screenToTile } from '../iso';
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
    const camera = new CameraController(this, WorldRenderer.roomBounds(this.state));
    // Debug aid: tap a tile to outline exactly that diamond.
    camera.onTap((world) => {
      const tile = screenToTile(world.x, world.y);
      renderer.showHighlight(inBounds(this.state.grid, tile.x, tile.y) ? tile : null);
    });
  }
}
