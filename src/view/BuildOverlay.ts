import Phaser from 'phaser';
import { FURNITURE } from '../data/furniture';
import { footprintTiles, tileAt, type Furniture } from '../sim/grid';
import type { PaintStroke } from '../ui/build';
import { wallQuad } from './wallHit';
import type { GameState } from '../sim/state';
import type { Ghost } from '../ui/build';
import { furnitureTexKey, isMirroredRot } from './textureKeys';
import { tileToScreen, ISO_HALF_H, ISO_HALF_W, type Point } from './iso';

/** Above floors but below furniture; the placement tint and ghost sit above everything but UI. */
const DEPTH_GRID = -19000;
const DEPTH_TINT = 900_000;
const DEPTH_GHOST = 900_001;
const GRID_LINE_COLOR = 0x111111;
const GRID_LINE_ALPHA = 0.18;
const BASIL = 0x3fa25b;
const TOMATO = 0xe2483d;
const TINT_ALPHA = 0.5;
const GHOST_ALPHA = 0.8;
const GHOST_INVALID_TINT = 0xff8c80;
const SAFFRON = 0xf5b82e;
const PAINT_ALPHA = 0.45;

/** Floor grid overlay, ghost sprite and valid/invalid footprint tint. Read-only view code. */
export class BuildOverlay {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly tint: Phaser.GameObjects.Graphics;
  private ghostImage: Phaser.GameObjects.Image | null = null;
  private readonly paint: Phaser.GameObjects.Graphics;
  private paintKey = '';
  private tintKey = '';
  private gridBuilt = false;
  private gridRoomKey = '';
  private room: GameState['room'] = { x0: 0, y0: 0, x1: 0, y1: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.grid = scene.add.graphics().setDepth(DEPTH_GRID).setVisible(false);
    this.tint = scene.add.graphics().setDepth(DEPTH_TINT).setVisible(false);
    this.paint = scene.add.graphics().setDepth(DEPTH_TINT).setVisible(false);
  }

  private diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, fill: boolean): void {
    const o = tileToScreen(x, y);
    const pts = [
      new Phaser.Math.Vector2(o.x, o.y),
      new Phaser.Math.Vector2(o.x + ISO_HALF_W, o.y + ISO_HALF_H),
      new Phaser.Math.Vector2(o.x, o.y + 2 * ISO_HALF_H),
      new Phaser.Math.Vector2(o.x - ISO_HALF_W, o.y + ISO_HALF_H),
    ];
    if (fill) g.fillPoints(pts, true);
    else g.strokePoints(pts, true);
  }

  private buildGrid(state: GameState): void {
    const g = this.grid;
    g.clear().lineStyle(1, GRID_LINE_COLOR, GRID_LINE_ALPHA);
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const t = tileAt(state.grid, x, y);
        if (t === 'floor_wood' || t === 'floor_tile') this.diamond(g, x, y, false);
      }
    }
    this.gridBuilt = true;
  }

  /** `ghost` null = browsing (grid only); `active` false hides everything. */
  sync(
    state: GameState,
    active: boolean,
    ghost: Ghost | null,
    selected: Furniture | null = null,
    stroke: PaintStroke | null = null,
  ): void {
    this.grid.setVisible(active);
    this.room = state.room;
    const roomKey = `${state.room.x0},${state.room.y0},${state.room.x1},${state.room.y1}`;
    if (roomKey !== this.gridRoomKey) {
      this.gridRoomKey = roomKey;
      this.gridBuilt = false; // the room grew: draw the grid again
    }
    if (active && !this.gridBuilt) this.buildGrid(state);
    this.syncPaint(active ? stroke : null);
    if (!active || !ghost) {
      this.ghostImage?.setVisible(false);
      // The selected piece (item card open) gets a saffron footprint.
      const sel = active ? selected : null;
      const key = sel ? `sel:${sel.id}:${sel.x},${sel.y},${sel.rot}` : '';
      if (key !== this.tintKey) {
        this.tintKey = key;
        this.tint.clear();
        if (sel) {
          this.tint.fillStyle(SAFFRON, TINT_ALPHA);
          for (const t of footprintTiles(sel.defId, sel.x, sel.y, sel.rot)) {
            this.diamond(this.tint, t.x, t.y, true);
          }
        }
      }
      this.tint.setVisible(sel !== null);
      return;
    }
    const { defId } = ghost.placing;
    const def = FURNITURE[defId];
    const ok = ghost.result.ok;
    const key = `${defId}:${ghost.x},${ghost.y},${ghost.rot}:${ok}`;
    if (key !== this.tintKey) {
      this.tintKey = key;
      this.tint.clear().fillStyle(ok ? BASIL : TOMATO, TINT_ALPHA);
      for (const t of footprintTiles(defId, ghost.x, ghost.y, ghost.rot)) {
        this.diamond(this.tint, t.x, t.y, true);
      }
    }
    this.tint.setVisible(true);
    const texKey = furnitureTexKey(defId, ghost.rot);
    this.ghostImage ??= this.scene.add.image(0, 0, texKey).setAlpha(GHOST_ALPHA);
    const o = tileToScreen(ghost.x, ghost.y);
    const img = this.ghostImage;
    img
      .setTexture(texKey)
      .setOrigin(def.spriteOrigin[0] / img.width, def.spriteOrigin[1] / img.height)
      .setFlipX(isMirroredRot(ghost.rot))
      .setPosition(o.x, o.y)
      .setDepth(DEPTH_GHOST)
      .setVisible(true);
    if (ok) img.clearTint();
    else img.setTint(GHOST_INVALID_TINT);
  }

  /** Tint over the tiles and wall segments of the current paint stroke. */
  private syncPaint(stroke: PaintStroke | null): void {
    const key = stroke
      ? `${stroke.tiles.map((t) => `${t.x},${t.y}`).join(';')}|${stroke.segments.join(';')}`
      : '';
    if (key === this.paintKey) return;
    this.paintKey = key;
    this.paint.clear().setVisible(stroke !== null);
    if (!stroke) return;
    this.paint.fillStyle(BASIL, PAINT_ALPHA);
    for (const t of stroke.tiles) this.diamond(this.paint, t.x, t.y, true);
    for (const id of stroke.segments) {
      const q = wallQuad(id, this.room).map((p) => new Phaser.Math.Vector2(p.x, p.y));
      if (q.length > 0) this.paint.fillPoints(q, true);
    }
  }

  /** World-space box around the visible ghost (sprite plus footprint), or null without one. */
  ghostBounds(
    ghost: Ghost | null,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!ghost || !this.ghostImage?.visible) return null;
    const b = this.ghostImage.getBounds();
    let box = { minX: b.x, minY: b.y, maxX: b.right, maxY: b.bottom };
    for (const t of footprintTiles(ghost.placing.defId, ghost.x, ghost.y, ghost.rot)) {
      const o = tileToScreen(t.x, t.y);
      box = {
        minX: Math.min(box.minX, o.x - ISO_HALF_W),
        minY: Math.min(box.minY, o.y),
        maxX: Math.max(box.maxX, o.x + ISO_HALF_W),
        maxY: Math.max(box.maxY, o.y + 2 * ISO_HALF_H),
      };
    }
    return box;
  }

  /** True when a world point is on the ghost (its footprint or its sprite). */
  ghostContains(ghost: Ghost, tile: Point, world: Point): boolean {
    const onTile = footprintTiles(ghost.placing.defId, ghost.x, ghost.y, ghost.rot).some(
      (t) => t.x === tile.x && t.y === tile.y,
    );
    return onTile || (this.ghostImage?.getBounds().contains(world.x, world.y) ?? false);
  }
}
