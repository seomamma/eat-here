import Phaser from 'phaser';
import { DOOR_X } from '../data/layout';
import { FURNITURE } from '../data/furniture';
import { rotatedFootprint } from '../sim/grid';
import type { GameState } from '../sim/state';
import { depthKey, tileRectBounds, tileToScreen, type Bounds, type Point } from './iso';
import { TEX, WALL_BACK_RISE } from './placeholderTextures';

/** Floors sit below everything; back walls are never in front of anything. */
const DEPTH_FLOOR = -20000;
const DEPTH_BACK_WALL = -10000;
/** Low walls and door frame sort just in front of the objects on their own tile. */
const DEPTH_FRONT_BIAS = 0.5;
/** Debug overlays on top of the world. */
const DEPTH_OVERLAY = 1_000_000;

/** Syncs Phaser game objects from GameState. Read-only: never mutates state. */
export class WorldRenderer {
  private tilesBuilt = false;
  private readonly furniture = new Map<string, Phaser.GameObjects.Image>();
  private highlight: Phaser.GameObjects.Image | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Screen-space bounds of the visible room: interior floor plus the full-height back walls.
   * Wall tiles (grid edge) are only the walls' footprint and are not part of the visible room.
   */
  static roomBounds(state: GameState): Bounds {
    const { width, height } = state.grid;
    const b = tileRectBounds(1, 1, width - 1, height);
    return { ...b, minY: b.minY - WALL_BACK_RISE };
  }

  sync(state: GameState): void {
    if (!this.tilesBuilt) {
      this.buildTiles(state);
      this.tilesBuilt = true;
    }
    this.syncFurniture(state);
  }

  /** Draws (or moves) the 1px diamond outline on a tile; null hides it. Debug aid. */
  showHighlight(tile: Point | null): void {
    if (!tile) {
      this.highlight?.setVisible(false);
      return;
    }
    const o = tileToScreen(tile.x, tile.y);
    this.highlight ??= this.scene.add
      .image(0, 0, TEX.tileHighlight)
      .setOrigin(0, 0)
      .setDepth(DEPTH_OVERLAY);
    this.highlight.setPosition(o.x - 16, o.y).setVisible(true);
  }

  /** Places an image whose top-left pixel sits at (x, y) on screen. */
  private put(x: number, y: number, key: string, depth: number): void {
    this.scene.add.image(x, y, key).setOrigin(0, 0).setDepth(depth);
  }

  private buildTiles(state: GameState): void {
    const { width, height, tiles } = state.grid;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        const o = tileToScreen(x, y);
        switch (tile) {
          case 'floor_wood':
            this.put(
              o.x - 16,
              o.y,
              TEX.floorWood[(x * 3 + y * 5) % 2] ?? TEX.floorWood[0],
              DEPTH_FLOOR,
            );
            this.frontLeftWall(state, x, y, o);
            break;
          case 'floor_tile':
            this.put(o.x - 16, o.y, TEX.floorTile, DEPTH_FLOOR);
            this.frontLeftWall(state, x, y, o);
            break;
          case 'door':
            this.put(o.x - 16, o.y, TEX.doorMat, DEPTH_FLOOR);
            this.put(o.x - 16, o.y - 24, TEX.doorFrame, depthKey(x, y) + DEPTH_FRONT_BIAS);
            break;
          case 'wall':
            this.wall(state, x, y, o);
            break;
          default:
            break;
        }
      }
    }
  }

  /**
   * Wall tiles are only footprints: they are drawn as a wall segment standing on the edge of the
   * adjacent interior tile. Back walls (x = 0 and y = 0) are full height, the x = width - 1 side
   * is a low cut-away wall. The y = height - 1 side is handled by frontLeftWall.
   */
  private wall(state: GameState, x: number, y: number, o: Point): void {
    const { width } = state.grid;
    if (x === 0 && y >= 1) {
      // Back-left wall, standing on the top-left edge of tile (1, y).
      const end = y === state.grid.height - 1;
      this.put(
        -16 * y,
        8 * y - 33,
        end ? TEX.wallBackLEnd : TEX.wallBackL,
        DEPTH_BACK_WALL + depthKey(x, y),
      );
    } else if (y === 0 && x >= 1 && x <= width - 2) {
      // Back-right wall, standing on the top-right edge of tile (x, 1).
      const end = x === width - 2;
      this.put(
        16 * x - 16,
        8 * x - 33,
        end ? TEX.wallBackREnd : TEX.wallBackR,
        DEPTH_BACK_WALL + depthKey(x, y),
      );
    } else if (x === width - 1 && y >= 1) {
      // Front-right low wall, standing on the bottom-right edge of tile (width - 2, y).
      this.put(o.x - 16, o.y - 4, TEX.wallFrontR, depthKey(x, y) + DEPTH_FRONT_BIAS);
    }
  }

  /** Low wall along the outer front-left edge of the bottom row (the door tile is the gap). */
  private frontLeftWall(state: GameState, x: number, y: number, o: Point): void {
    if (y !== state.grid.height - 1 || x === DOOR_X) return;
    this.put(o.x - 16, o.y + 4, TEX.wallFrontL, depthKey(x, y) + DEPTH_FRONT_BIAS);
  }

  private syncFurniture(state: GameState): void {
    const live = new Set<string>();
    for (const f of state.furniture) {
      live.add(f.id);
      const def = FURNITURE[f.defId];
      const [w, h] = rotatedFootprint(f.defId, f.rot);
      let img = this.furniture.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, f.defId);
        this.furniture.set(f.id, img);
      }
      // The sprite's footprint top corner sits on the projected origin of tile (x, y).
      // rot 1 is the same sprite mirrored around that corner (flip happens around the origin).
      const o = tileToScreen(f.x, f.y);
      img
        .setOrigin(def.spriteOrigin[0] / img.width, def.spriteOrigin[1] / img.height)
        .setFlipX(f.rot === 1)
        .setPosition(o.x, o.y)
        .setDepth(depthKey(f.x + w - 1, f.y + h - 1));
    }
    for (const [id, img] of this.furniture) {
      if (!live.has(id)) {
        img.destroy();
        this.furniture.delete(id);
      }
    }
  }
}
