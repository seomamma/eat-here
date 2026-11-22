import Phaser from 'phaser';
import { FURNITURE } from '../data/furniture';
import type { GameState } from '../sim/state';
import { TEX, TILE } from './placeholderTextures';

/** Depth bands: floors < walls < furniture (furniture uses base Y, always > 0). */
const DEPTH_FLOOR = -2000;
const DEPTH_WALL = -1000;

/** Syncs Phaser game objects from GameState. Read-only: never mutates state. */
export class WorldRenderer {
  private tilesBuilt = false;
  private readonly furniture = new Map<string, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** World size in pixels of the room grid. */
  static worldSize(state: GameState): { width: number; height: number } {
    return { width: state.grid.width * TILE, height: state.grid.height * TILE };
  }

  sync(state: GameState): void {
    if (!this.tilesBuilt) {
      this.buildTiles(state);
      this.tilesBuilt = true;
    }
    this.syncFurniture(state);
  }

  private buildTiles(state: GameState): void {
    const { width, height, tiles } = state.grid;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        let key: string;
        let depth = DEPTH_FLOOR;
        switch (tile) {
          case 'floor_wood':
            key = TEX.floorWood[(x * 3 + y * 5) % 2 === 0 ? 0 : 1] ?? TEX.floorWood[0];
            break;
          case 'floor_tile':
            key = TEX.floorTile;
            break;
          case 'door':
            key = TEX.door;
            break;
          case 'wall':
            depth = DEPTH_WALL;
            if (y === 0)
              key = x === 0 ? TEX.wallBackL : x === width - 1 ? TEX.wallBackR : TEX.wallBack;
            else key = x === 0 ? TEX.wallSideL : TEX.wallSideR;
            break;
          default:
            continue;
        }
        this.scene.add
          .image(x * TILE, y * TILE, key)
          .setOrigin(0, 0)
          .setDepth(depth);
      }
    }
  }

  private syncFurniture(state: GameState): void {
    const live = new Set<string>();
    for (const f of state.furniture) {
      live.add(f.id);
      const [, h] = FURNITURE[f.defId].footprint;
      const baseY = (f.y + h) * TILE;
      let img = this.furniture.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, f.defId).setOrigin(0, 1);
        this.furniture.set(f.id, img);
      }
      // Sprite is anchored at the bottom-left of its footprint; taller art grows upwards.
      img.setPosition(f.x * TILE, baseY).setDepth(baseY);
    }
    for (const [id, img] of this.furniture) {
      if (!live.has(id)) {
        img.destroy();
        this.furniture.delete(id);
      }
    }
  }
}
