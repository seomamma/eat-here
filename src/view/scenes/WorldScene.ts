import Phaser from 'phaser';
import { inBounds } from '../../sim/grid';
import type { Game } from '../../sim/game';
import { CameraController } from '../CameraController';
import { screenToTile, tileToScreen } from '../iso';
import { generatePlaceholderTextures } from '../placeholderTextures';
import { WorldRenderer } from '../WorldRenderer';

const CANVAS_COLOR = 0xf6f3ee;

export class WorldScene extends Phaser.Scene {
  private sim!: Game;
  private world!: WorldRenderer;

  constructor() {
    super('WorldScene');
  }

  init(data: { sim: Game }): void {
    this.sim = data.sim;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CANVAS_COLOR);
    generatePlaceholderTextures(this.textures);
    const state = this.sim.state;
    this.world = new WorldRenderer(this);
    this.world.sync(state);
    this.world.syncCharacters(state, this.sim.alpha);
    const unsubs = [
      this.sim.events.on('guestEmote', (e) => this.world.showEmote(e.guestId, e.emote)),
      this.sim.events.on('paid', (e) => this.world.showCoinPopup(e.x, e.y, e.amount)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    if (new URLSearchParams(location.search).has('debug')) this.exposeDebugHook();
    const camera = new CameraController(this, WorldRenderer.roomBounds(state));
    // Debug aid: tap a tile to outline it and send the debug walker there.
    camera.onTap((world) => {
      const tile = screenToTile(world.x, world.y);
      const inside = inBounds(state.grid, tile.x, tile.y);
      this.world.showHighlight(inside ? tile : null);
      if (inside) this.sim.dispatch({ type: 'debugWalkTo', x: tile.x, y: tile.y });
    });
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
    this.world.sync(this.sim.state);
    this.world.syncCharacters(this.sim.state, this.sim.alpha);
  }
}
