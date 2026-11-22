import Phaser from 'phaser';
import { FURNITURE } from '../data/furniture';
import { footprintTiles, tileAt } from '../sim/grid';
import type { GameState } from '../sim/state';
import type { Ghost } from '../ui/build';
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

/** Floor grid overlay, ghost sprite and valid/invalid footprint tint. Read-only view code. */
export class BuildOverlay {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly tint: Phaser.GameObjects.Graphics;
  private ghostImage: Phaser.GameObjects.Image | null = null;
  private tintKey = '';
  private gridBuilt = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.grid = scene.add.graphics().setDepth(DEPTH_GRID).setVisible(false);
    this.tint = scene.add.graphics().setDepth(DEPTH_TINT).setVisible(false);
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
  sync(state: GameState, active: boolean, ghost: Ghost | null): void {
    this.grid.setVisible(active);
    if (active && !this.gridBuilt) this.buildGrid(state);
    if (!active || !ghost) {
      this.tint.setVisible(false);
      this.ghostImage?.setVisible(false);
      this.tintKey = '';
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
    this.ghostImage ??= this.scene.add.image(0, 0, defId).setAlpha(GHOST_ALPHA);
    const o = tileToScreen(ghost.x, ghost.y);
    const img = this.ghostImage;
    img
      .setTexture(defId)
      .setOrigin(def.spriteOrigin[0] / img.width, def.spriteOrigin[1] / img.height)
      .setFlipX(ghost.rot === 1)
      .setPosition(o.x, o.y)
      .setDepth(DEPTH_GHOST)
      .setVisible(true);
    if (ok) img.clearTint();
    else img.setTint(GHOST_INVALID_TINT);
  }

  /** True when a world point is on the ghost (its footprint or its sprite). */
  ghostContains(ghost: Ghost, tile: Point, world: Point): boolean {
    const onTile = footprintTiles(ghost.placing.defId, ghost.x, ghost.y, ghost.rot).some(
      (t) => t.x === tile.x && t.y === tile.y,
    );
    return onTile || (this.ghostImage?.getBounds().contains(world.x, world.y) ?? false);
  }
}
