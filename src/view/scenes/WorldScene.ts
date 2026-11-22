import Phaser from 'phaser';
import { furnitureAt, inBounds } from '../../sim/grid';
import type { Game } from '../../sim/game';
import { BuildOverlay } from '../BuildOverlay';
import { CameraController } from '../CameraController';
import { screenToTile, tileToScreen } from '../iso';
import { generatePlaceholderTextures } from '../placeholderTextures';
import { SurroundingsRenderer } from '../SurroundingsRenderer';
import { GROUND_BG_COLOR, generateSurroundingsTextures } from '../surroundingsTextures';
import { buildMode, ghost, ghostRect, moveGhostTo, startMoving } from '../../ui/build';
import { selectGuest, selectedGuestId } from '../../ui/selection';
import type { ObjectDrag } from '../CameraController';
import { WorldRenderer } from '../WorldRenderer';

export class WorldScene extends Phaser.Scene {
  private sim!: Game;
  private world!: WorldRenderer;
  private build!: BuildOverlay;

  constructor() {
    super('WorldScene');
  }

  init(data: { sim: Game }): void {
    this.sim = data.sim;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BG_COLOR);
    generatePlaceholderTextures(this.textures);
    generateSurroundingsTextures(this.textures);
    new SurroundingsRenderer(this);
    const state = this.sim.state;
    this.world = new WorldRenderer(this);
    this.world.sync(state);
    this.world.syncCharacters(state, this.sim.alpha);
    this.build = new BuildOverlay(this);
    const unsubs = [
      this.sim.events.on('guestEmote', (e) => this.world.showEmote(e.guestId, e.emote)),
      this.sim.events.on('paid', (e) => this.world.showCoinPopup(e.x, e.y, e.amount)),
      this.sim.events.on('dishServed', (e) => this.world.hopOnServe(state, e.guestId)),
      this.sim.events.on('giftReceived', (e) => this.world.sparklesAtGuest(e.guestId)),
      this.sim.events.on('heartGained', (e) => this.world.sparklesAtGuest(e.guestId)),
      this.sim.events.on('recipeLeveledUp', () => this.world.sparklesAtOven(state)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    if (new URLSearchParams(location.search).has('debug')) this.exposeDebugHook();
    const camera = new CameraController(
      this,
      SurroundingsRenderer.panBounds(WorldRenderer.roomBounds(state)),
      WorldRenderer.roomBounds(state),
    );
    camera.setObjectDrag(this.objectDrag());
    // Debug aid: tap a tile to outline it and send the debug walker there.
    camera.onTap((world) => {
      if (buildMode.value) {
        this.onBuildTap(world);
        return;
      }
      // A guest under the finger wins; otherwise the tap clears the selection and acts on the tile.
      const guestId = this.world.guestAt(state, world.x, world.y);
      selectGuest(guestId);
      if (guestId) return;
      const tile = screenToTile(world.x, world.y);
      const inside = inBounds(state.grid, tile.x, tile.y);
      this.world.showHighlight(inside ? tile : null);
      if (inside) this.sim.dispatch({ type: 'debugWalkTo', x: tile.x, y: tile.y });
    });
  }

  /** Build mode: a tap puts the ghost on that tile, or picks up the piece standing there. */
  private onBuildTap(world: { x: number; y: number }): void {
    const state = this.sim.state;
    const tile = screenToTile(world.x, world.y);
    if (!inBounds(state.grid, tile.x, tile.y)) return;
    if (ghost.value) {
      moveGhostTo(tile.x, tile.y);
      return;
    }
    const id = furnitureAt(state, tile.x, tile.y);
    if (id) startMoving(id);
  }

  /** Build mode: a one-finger drag that starts on the ghost moves it instead of panning. */
  private objectDrag(): ObjectDrag {
    const state = this.sim.state;
    let grab = { x: 0, y: 0 };
    return {
      begin: (world) => {
        const g = ghost.value;
        if (!buildMode.value || !g) return false;
        const tile = screenToTile(world.x, world.y);
        if (!this.build.ghostContains(g, tile, world)) return false;
        grab = { x: g.x - tile.x, y: g.y - tile.y };
        return true;
      },
      move: (world) => {
        const tile = screenToTile(world.x, world.y);
        const { width, height } = state.grid;
        moveGhostTo(
          Math.min(width - 1, Math.max(0, tile.x + grab.x)),
          Math.min(height - 1, Math.max(0, tile.y + grab.y)),
        );
      },
      end: () => {},
    };
  }

  /** Test hook (?debug): CSS-pixel client position of a tile centre. */
  private exposeDebugHook(): void {
    const cam = this.cameras.main;
    const canvas = this.game.canvas;
    (window as unknown as Record<string, unknown>).__tileToClient = (x: number, y: number) => {
      const o = tileToScreen(x + 0.5, y + 0.5);
      const r = canvas.getBoundingClientRect();
      const k = canvas.width / r.width;
      return {
        x: r.left + (cam.x + (o.x - cam.scrollX) * cam.zoom) / k,
        y: r.top + (cam.y + (o.y - cam.scrollY) * cam.zoom) / k,
      };
    };
  }

  override update(_time: number, delta: number): void {
    this.sim.update(delta);
    const g = ghost.value;
    this.world.setHiddenFurniture(g?.placing.kind === 'move' ? g.placing.id : null);
    this.world.sync(this.sim.state);
    this.world.syncCharacters(this.sim.state, this.sim.alpha);
    this.world.syncSelection(selectedGuestId.value);
    this.build.sync(this.sim.state, buildMode.value, g);
    this.publishGhostRect(g);
  }

  /**
   * Tells the UI where the ghost is on screen (CSS px, rounded so the floating controls do not
   * jitter); the signal is only written when the rounded rectangle changes.
   */
  private publishGhostRect(g: typeof ghost.value): void {
    const box = this.build.ghostBounds(buildMode.value ? g : null);
    let next: { left: number; top: number; right: number; bottom: number } | null = null;
    if (box) {
      const cam = this.cameras.main;
      const r = this.game.canvas.getBoundingClientRect();
      const k = this.game.canvas.width / r.width;
      const toX = (wx: number) => Math.round(r.left + (cam.x + (wx - cam.scrollX) * cam.zoom) / k);
      const toY = (wy: number) => Math.round(r.top + (cam.y + (wy - cam.scrollY) * cam.zoom) / k);
      next = {
        left: toX(box.minX),
        top: toY(box.minY),
        right: toX(box.maxX),
        bottom: toY(box.maxY),
      };
    }
    const cur = ghostRect.peek();
    const same =
      cur === next ||
      (cur !== null &&
        next !== null &&
        cur.left === next.left &&
        cur.top === next.top &&
        cur.right === next.right &&
        cur.bottom === next.bottom);
    if (!same) ghostRect.value = next;
  }
}
