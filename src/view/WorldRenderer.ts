import Phaser from 'phaser';
import { DOOR_X } from '../data/layout';
import { FURNITURE } from '../data/furniture';
import type { IsoDir } from '../sim/characters';
import { rotatedFootprint } from '../sim/grid';
import type { GameState } from '../sim/state';
import { depthKey, tileRectBounds, tileToScreen, type Bounds, type Point } from './iso';
import { interpolatePosition } from './interpolate';
import {
  CHAR_FRAME_COUNT,
  TEX,
  WALL_BACK_RISE,
  charTexKey,
  type CharAnim,
  type CharFacing,
} from './placeholderTextures';

/** Floors sit below everything; back walls are never in front of anything. */
const DEPTH_FLOOR = -20000;
const DEPTH_BACK_WALL = -10000;
/** Low walls and door frame sort just in front of the objects on their own tile. */
const DEPTH_FRONT_BIAS = 0.5;
/** Debug overlays on top of the world. */
const DEPTH_OVERLAY = 1_000_000;

/** Animation speed (ART_DIRECTION §6: 8 fps loops; idle breathing is slower). */
const WALK_FPS = 8;
const IDLE_FPS = 2;

/** Front = down-right, back = up-right; the other two directions mirror them. */
const DIR_VIEW: Record<IsoDir, { facing: CharFacing; flip: boolean }> = {
  dr: { facing: 'front', flip: false },
  dl: { facing: 'front', flip: true },
  ur: { facing: 'back', flip: false },
  ul: { facing: 'back', flip: true },
};

function animKey(facing: CharFacing, anim: CharAnim): string {
  return `char_${facing}_${anim}`;
}

/** Syncs Phaser game objects from GameState. Read-only: never mutates state. */
export class WorldRenderer {
  private tilesBuilt = false;
  private readonly furniture = new Map<string, Phaser.GameObjects.Image>();
  private readonly characters = new Map<string, Phaser.GameObjects.Sprite>();
  private highlight: Phaser.GameObjects.Image | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.createAnimations();
  }

  private createAnimations(): void {
    for (const facing of ['front', 'back'] as const) {
      for (const anim of ['idle', 'walk'] as const) {
        const key = animKey(facing, anim);
        if (this.scene.anims.exists(key)) continue;
        this.scene.anims.create({
          key,
          frames: Array.from({ length: CHAR_FRAME_COUNT[anim] }, (_, i) => ({
            key: charTexKey(facing, anim, i),
          })),
          frameRate: anim === 'walk' ? WALK_FPS : IDLE_FPS,
          repeat: -1,
        });
      }
    }
  }

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

  /**
   * Places characters at their position interpolated between the last two ticks (`alpha` is the
   * fraction into the next tick). Feet sit on the tile centre; depth uses the interpolated
   * position, so they sort with furniture by x + y and always draw above the back walls.
   */
  syncCharacters(state: GameState, alpha: number): void {
    const live = new Set<string>();
    for (const c of state.characters) {
      live.add(c.id);
      let sprite = this.characters.get(c.id);
      if (!sprite) {
        sprite = this.scene.add.sprite(0, 0, charTexKey('front', 'idle', 0)).setOrigin(0.5, 1);
        this.characters.set(c.id, sprite);
      }
      const p = interpolatePosition(c, alpha);
      // Tile (x, y) has its diamond centre at tileToScreen(x + 0.5, y + 0.5).
      const o = tileToScreen(p.x + 0.5, p.y + 0.5);
      const view = DIR_VIEW[c.dir];
      sprite
        .setPosition(Math.round(o.x), Math.round(o.y) + 1) // feet row sits on the centre pixel
        .setFlipX(view.flip)
        .setDepth(depthKey(p.x, p.y));
      sprite.play(animKey(view.facing, c.path.length > 0 ? 'walk' : 'idle'), true);
    }
    for (const [id, sprite] of this.characters) {
      if (!live.has(id)) {
        sprite.destroy();
        this.characters.delete(id);
      }
    }
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
