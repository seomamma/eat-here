import Phaser from 'phaser';
import { furnitureAt, inBounds, tileAt } from '../../sim/grid';
import type { Game } from '../../sim/game';
import { BuildOverlay } from '../BuildOverlay';
import { CameraController } from '../CameraController';
import { screenToTile, tileRectBounds, tileToScreen, type Bounds } from '../iso';
import { addedTiles } from '../../sim/systems/expansion';
import { rankUpsClosed } from '../../ui/store';
import { installArtAliases, preloadArt } from '../art';
import { WALL_BACK_RISE, generatePlaceholderTextures } from '../placeholderTextures';
import { SurroundingsRenderer } from '../SurroundingsRenderer';
import { GROUND_BG_COLOR, generateSurroundingsTextures } from '../surroundingsTextures';
import {
  buildMode,
  endPaintStroke,
  ghost,
  ghostRect,
  moveGhostTo,
  paintAt,
  paintStroke,
  paintStyle,
  selectPiece,
  selectedPiece,
  type PaintHit,
} from '../../ui/build';
import { wallSegmentAt } from '../wallHit';
import { selectGuest, selectedGuestId } from '../../ui/selection';
import type { ObjectDrag } from '../CameraController';
import { StreetRenderer } from '../StreetRenderer';
import { WorldRenderer } from '../WorldRenderer';

export class WorldScene extends Phaser.Scene {
  private sim!: Game;
  private world!: WorldRenderer;
  private build!: BuildOverlay;
  private surroundings!: SurroundingsRenderer;
  private street!: StreetRenderer;
  private camera!: CameraController;
  /** Room growth waiting for the RANK UP modal to close before the camera shows it. */
  private pendingExpansion: { tiles: { x: number; y: number }[]; area: Bounds } | null = null;

  constructor() {
    super('WorldScene');
  }

  init(data: { sim: Game }): void {
    this.sim = data.sim;
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GROUND_BG_COLOR);
    installArtAliases(this.textures);
    generatePlaceholderTextures(this.textures);
    generateSurroundingsTextures(this.textures);
    const state = this.sim.state;
    this.surroundings = new SurroundingsRenderer(this);
    this.surroundings.sync(state.room);
    this.world = new WorldRenderer(this);
    this.world.sync(state);
    this.world.syncCharacters(state, this.sim.alpha);
    this.street = new StreetRenderer(this, this.world, state.seed);
    this.build = new BuildOverlay(this);
    const unsubs = [
      this.sim.events.on('guestEmote', (e) => this.world.showEmote(e.guestId, e.emote)),
      this.sim.events.on('paid', (e) => this.world.showCoinPopup(e.x, e.y, e.amount)),
      this.sim.events.on('dishServed', (e) => this.world.hopOnServe(state, e.guestId)),
      this.sim.events.on('giftReceived', (e) => this.world.sparklesAtGuest(e.guestId)),
      this.sim.events.on('heartGained', (e) => this.world.sparklesAtGuest(e.guestId)),
      this.sim.events.on('recipeLeveledUp', () => this.world.sparklesAtOven(state)),
      this.sim.events.on('furnitureLeveledUp', (e) => this.world.sparklesAtFurniture(state, e.id)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((u) => u()));
    if (new URLSearchParams(location.search).has('debug')) this.exposeDebugHook();
    const camera = new CameraController(
      this,
      SurroundingsRenderer.panBounds(WorldRenderer.roomBounds(state)),
      WorldRenderer.roomBounds(state),
    );
    this.camera = camera;
    this.watchExpansion(camera);
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

  /**
   * A rank-up grows the room: the pan bounds follow at once, but the camera only glides to the
   * new area (and the new floor sparkles) after the player closes the RANK UP modal.
   */
  private watchExpansion(camera: CameraController): void {
    const off = this.sim.events.on('roomExpanded', (e) => {
      const { room, added } = e;
      const before = {
        x0: room.x0 + added.minusX,
        y0: room.y0 + added.minusY,
        x1: room.x1 - added.plusX,
        y1: room.y1,
      };
      const tiles = addedTiles(before, room);
      let area: Bounds | null = null;
      for (const t of tiles) {
        const b = tileRectBounds(t.x, t.y, t.x + 1, t.y + 1);
        area = area
          ? {
              minX: Math.min(area.minX, b.minX),
              minY: Math.min(area.minY, b.minY),
              maxX: Math.max(area.maxX, b.maxX),
              maxY: Math.max(area.maxY, b.maxY),
            }
          : b;
      }
      const roomBounds = WorldRenderer.boundsOfRoom(room);
      camera.setRoomBounds(SurroundingsRenderer.panBounds(roomBounds), roomBounds);
      if (area)
        this.pendingExpansion = { tiles, area: { ...area, minY: area.minY - WALL_BACK_RISE } };
    });
    const unsub = rankUpsClosed.subscribe(() => {
      const p = this.pendingExpansion;
      if (!p) return;
      this.pendingExpansion = null;
      camera.showArea(p.area);
      this.world.sparklesOnTiles(p.tiles);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      unsub();
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
    // Tapping a piece opens its item card; tapping bare floor closes it.
    selectPiece(furnitureAt(state, tile.x, tile.y) ?? null);
  }

  /** What a paint stroke would touch at a world point: a floor tile or a wall segment. */
  private paintHit(world: { x: number; y: number }): PaintHit | null {
    const style = paintStyle.value;
    const state = this.sim.state;
    if (style?.kind === 'wall') {
      const segment = wallSegmentAt(world.x, world.y, state.room);
      return segment ? { segment } : null;
    }
    const tile = screenToTile(world.x, world.y);
    const t = tileAt(state.grid, tile.x, tile.y);
    return t === 'floor_wood' || t === 'floor_tile' ? { tile } : null;
  }

  /** Build mode: a one-finger drag that starts on the ghost moves it instead of panning. */
  private objectDrag(): ObjectDrag {
    const state = this.sim.state;
    let grab = { x: 0, y: 0 };
    let painting = false;
    return {
      begin: (world) => {
        if (buildMode.value && paintStyle.value) {
          // A drag that starts on paintable ground paints; elsewhere it pans as usual.
          painting = paintAt(this.paintHit(world));
          return painting;
        }
        const g = ghost.value;
        if (!buildMode.value || !g) return false;
        const tile = screenToTile(world.x, world.y);
        if (!this.build.ghostContains(g, tile, world)) return false;
        grab = { x: g.x - tile.x, y: g.y - tile.y };
        return true;
      },
      move: (world) => {
        if (painting) {
          paintAt(this.paintHit(world));
          return;
        }
        const tile = screenToTile(world.x, world.y);
        const { room } = state;
        moveGhostTo(
          Math.min(room.x1, Math.max(room.x0, tile.x + grab.x)),
          Math.min(room.y1, Math.max(room.y0, tile.y + grab.y)),
        );
      },
      end: () => {
        if (painting) endPaintStroke();
        painting = false;
      },
    };
  }

  /** Test hook (?debug): CSS-pixel client position of a tile centre. */
  private exposeDebugHook(): void {
    const cam = this.cameras.main;
    const canvas = this.game.canvas;
    (window as unknown as Record<string, unknown>).__street = this.street;
    (window as unknown as Record<string, unknown>).__cam = cam;
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
    this.camera.update(delta);
    const g = ghost.value;
    this.world.setHiddenFurniture(g?.placing.kind === 'move' ? g.placing.id : null);
    this.world.sync(this.sim.state);
    this.surroundings.sync(this.sim.state.room);
    this.world.syncCharacters(this.sim.state, this.sim.alpha);
    this.street.update(this.sim.isPaused ? 0 : (delta / 1000) * this.sim.speed, this.sim.state);
    this.world.syncSelection(selectedGuestId.value);
    const selected = this.sim.state.furniture.find((f) => f.id === selectedPiece.value) ?? null;
    this.build.sync(this.sim.state, buildMode.value, g, selected, paintStroke.value);
    this.publishGhostRect(g);
  }

  /**
   * Tells the UI where the ghost is on screen (CSS px, rounded so the floating controls do not
   * jitter); the signal is only written when the rounded rectangle changes.
   */
  private publishGhostRect(g: typeof ghost.value): void {
    const picked = buildMode.value && !g ? selectedPiece.value : null;
    const box = picked
      ? this.world.furnitureBounds(picked)
      : this.build.ghostBounds(buildMode.value ? g : null);
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
