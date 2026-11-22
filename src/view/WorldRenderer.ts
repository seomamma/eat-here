import Phaser from 'phaser';
import { DOOR_X } from '../data/layout';
import { FURNITURE } from '../data/furniture';
import { isGuest, isStaff, type Character, type IsoDir } from '../sim/characters';
import type { GuestEmote } from '../sim/events';
import { footprintTiles, furnitureAt, rotatedFootprint, type Furniture } from '../sim/grid';
import type { GameState } from '../sim/state';
import { depthKey, tileRectBounds, tileToScreen, type Bounds, type Point } from './iso';
import { interpolatePosition } from './interpolate';
import {
  CHAR_ANIMS,
  CHAR_FRAME_COUNT,
  CHAR_VARIANT_COUNT,
  COIN_TEX,
  DISH_TEX,
  EMOTE_TEX,
  ORDER_BUBBLE_TEX,
  OVEN_TEX,
  TEX,
  WALL_BACK_RISE,
  charTexKey,
  staffVariant,
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
/**
 * Furniture sorts a bit behind characters on the same x + y diagonal: someone standing in
 * front of a multi-tile piece (e.g. the chef at the oven) must be drawn over it.
 */
const DEPTH_FURNITURE_BIAS = -0.1;
/** Dishes sit just in front of the furniture they stand on. */
const DEPTH_DISH_BIAS = 0.05;
/** Dish icon heights above the tile centre: pass counter top, table top (px). */
const PASS_TOP_PX = 8;
const TABLE_TOP_PX = 9;
/** Carried dish: bottom of the icon this far above the character's feet. */
const CARRY_LIFT_PX = 4;
/** Oven flicker period while baking. */
const OVEN_FLICKER_MS = 220;

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

function animKey(variant: number, facing: CharFacing, anim: CharAnim): string {
  return `char${variant}_${facing}_${anim}`;
}

/** Seated guests sit just in front of their chair (same tile) and a bit higher than standing. */
const DEPTH_SEATED_BIAS = 0.25;
const SEATED_LIFT_PX = 2;
/** Grid step of a screen facing (a seated guest looks at the table this way). */
const STEP_OF_DIR: Record<IsoDir, { x: number; y: number }> = {
  dr: { x: 1, y: 0 },
  dl: { x: 0, y: 1 },
  ul: { x: -1, y: 0 },
  ur: { x: 0, y: -1 },
};
/** Eating uses a slower loop than walking. */
const EAT_FPS = 2;
const COOK_FPS = 3;

/** Palette index of a character: 0 = debug walker, guest variants follow. */
function paletteOf(c: Character): number {
  if (isStaff(c)) return staffVariant(c.role);
  return isGuest(c) ? (c.variant % GUEST_VARIANTS) + 1 : 0;
}
/** Guest palettes are variants 1..3 (0 = debug walker, then staff). */
const GUEST_VARIANTS = 3;

function animOf(c: Character): CharAnim {
  if (isStaff(c)) {
    if (c.path.length > 0) return c.carrying ? 'carry' : 'walk';
    return c.phase === 'working' && c.action === 'cook' ? 'cook' : 'idle';
  }
  if (c.path.length > 0) return 'walk';
  if (isGuest(c)) {
    if (c.phase === 'eating') return 'eat';
    if (c.phase === 'browsing' || c.phase === 'paying') return 'sit';
  }
  return 'idle';
}

/** Short-lived world effects (emote bubbles, coin popups), animated from scene time. */
const EMOTE_POP_MS = 180;
const EMOTE_HOLD_MS = 1100;
const EMOTE_FADE_MS = 400;
const EMOTE_ABOVE_PX = 30;
const COIN_RISE_PX = 16;
const COIN_MS = 1100;
const COIN_FADE_MS = 400;
const COIN_ABOVE_PX = 26;
const COIN_TEXT_PX = 8;
const COIN_TEXT_COLOR = '#ffffff';
const COIN_TEXT_STROKE = '#111111';

interface Effect {
  born: number;
  /** Returns false when finished. */
  update(now: number): boolean;
  destroy(): void;
}

/** Syncs Phaser game objects from GameState. Read-only: never mutates state. */
export class WorldRenderer {
  private tilesBuilt = false;
  private readonly furniture = new Map<string, Phaser.GameObjects.Image>();
  private readonly characters = new Map<string, Phaser.GameObjects.Sprite>();
  private highlight: Phaser.GameObjects.Image | null = null;
  private effects: Effect[] = [];
  /** Persistent state-driven overlays: status bubbles above guests and dish icons. */
  private readonly bubbles = new Map<string, Phaser.GameObjects.Image>();
  private readonly dishes = new Map<string, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {
    this.createAnimations();
  }

  private createAnimations(): void {
    const fps: Record<CharAnim, number> = {
      walk: WALK_FPS,
      idle: IDLE_FPS,
      sit: IDLE_FPS,
      eat: EAT_FPS,
      carry: WALK_FPS,
      cook: COOK_FPS,
    };
    for (let v = 0; v < CHAR_VARIANT_COUNT; v++) {
      for (const facing of ['front', 'back'] as const) {
        for (const anim of CHAR_ANIMS) {
          const key = animKey(v, facing, anim);
          if (this.scene.anims.exists(key)) continue;
          this.scene.anims.create({
            key,
            frames: Array.from({ length: CHAR_FRAME_COUNT[anim] }, (_, i) => ({
              key: charTexKey(v, facing, anim, i),
            })),
            frameRate: fps[anim],
            repeat: -1,
          });
        }
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
        sprite = this.scene.add
          .sprite(0, 0, charTexKey(paletteOf(c), 'front', 'idle', 0))
          .setOrigin(0.5, 1);
        this.characters.set(c.id, sprite);
      }
      const p = interpolatePosition(c, alpha);
      // Tile (x, y) has its diamond centre at tileToScreen(x + 0.5, y + 0.5).
      const o = tileToScreen(p.x + 0.5, p.y + 0.5);
      const view = DIR_VIEW[c.dir];
      const anim = animOf(c);
      const seated = anim === 'sit' || anim === 'eat';
      sprite
        .setPosition(Math.round(o.x), Math.round(o.y) + 1 - (seated ? SEATED_LIFT_PX : 0)) // feet row sits on the centre pixel
        .setFlipX(view.flip)
        .setDepth(depthKey(p.x, p.y) + (seated ? DEPTH_SEATED_BIAS : 0));
      sprite.play(animKey(paletteOf(c), view.facing, anim), true);
    }
    for (const [id, sprite] of this.characters) {
      if (!live.has(id)) {
        sprite.destroy();
        this.characters.delete(id);
      }
    }
    this.syncBubbles(state);
    this.syncDishes(state);
    const now = this.scene.time.now;
    this.effects = this.effects.filter((e) => {
      const alive = e.update(now);
      if (!alive) e.destroy();
      return alive;
    });
  }

  /**
   * Bubbles that last as long as a guest's state does: raised hand while waiting to order,
   * the dish while waiting for food. Driven by state, so they follow the guest and disappear
   * the moment the state changes.
   */
  private syncBubbles(state: GameState): void {
    const live = new Set<string>();
    for (const c of state.characters) {
      if (!isGuest(c)) continue;
      let tex: string | null = null;
      if (c.phase === 'wantsToOrder') tex = EMOTE_TEX.hand;
      else if (c.phase === 'waitingForFood' && c.recipeId) tex = ORDER_BUBBLE_TEX[c.recipeId];
      const sprite = this.characters.get(c.id);
      if (!tex || !sprite) continue;
      live.add(c.id);
      let img = this.bubbles.get(c.id);
      if (!img) {
        img = this.scene.add.image(0, 0, tex).setOrigin(0.5, 1);
        this.bubbles.set(c.id, img);
      }
      img
        .setTexture(tex)
        .setPosition(Math.round(sprite.x), Math.round(sprite.y) - EMOTE_ABOVE_PX)
        .setDepth(DEPTH_OVERLAY);
    }
    for (const [id, img] of this.bubbles) {
      if (!live.has(id)) {
        img.destroy();
        this.bubbles.delete(id);
      }
    }
  }

  /** Dish icons: carried by staff, on the pass counter, and on the table while a guest eats. */
  private syncDishes(state: GameState): void {
    const want = new Map<string, { tex: string; x: number; y: number; depth: number }>();
    const furnitureDepth = (f: Furniture) => {
      const [w, h] = rotatedFootprint(f.defId, f.rot);
      return depthKey(f.x + w - 1, f.y + h - 1) + DEPTH_FURNITURE_BIAS;
    };
    for (const c of state.characters) {
      const sprite = this.characters.get(c.id);
      if (!sprite) continue;
      if (isStaff(c) && c.carrying) {
        want.set(`carry:${c.id}`, {
          tex: DISH_TEX[c.carrying],
          x: Math.round(sprite.x),
          y: Math.round(sprite.y) - CARRY_LIFT_PX,
          depth: sprite.depth + 0.01,
        });
      } else if (isGuest(c) && c.phase === 'eating' && c.recipeId && c.seatId) {
        const chair = state.furniture.find((f) => f.id === c.seatId);
        const step = STEP_OF_DIR[c.dir];
        const table = chair
          ? state.furniture.find(
              (f) => f.id === furnitureAt(state, chair.x + step.x, chair.y + step.y),
            )
          : undefined;
        if (chair && table) {
          const o = tileToScreen(chair.x + step.x + 0.5, chair.y + step.y + 0.5);
          want.set(`table:${c.id}`, {
            tex: DISH_TEX[c.recipeId],
            x: Math.round(o.x),
            y: Math.round(o.y) - TABLE_TOP_PX,
            depth: furnitureDepth(table) + DEPTH_DISH_BIAS,
          });
        }
      }
    }
    const pass = state.furniture.find((f) => f.defId === 'counter_pass');
    if (pass) {
      const tiles = footprintTiles(pass.defId, pass.x, pass.y, pass.rot);
      for (const o of state.orders) {
        const t = o.status === 'ready' && o.slot !== null ? tiles[o.slot] : undefined;
        if (!t) continue;
        const p = tileToScreen(t.x + 0.5, t.y + 0.5);
        want.set(`pass:${o.id}`, {
          tex: DISH_TEX[o.recipeId],
          x: Math.round(p.x),
          y: Math.round(p.y) - PASS_TOP_PX,
          depth: furnitureDepth(pass) + DEPTH_DISH_BIAS,
        });
      }
    }
    for (const [key, w] of want) {
      let img = this.dishes.get(key);
      if (!img) {
        img = this.scene.add.image(0, 0, w.tex).setOrigin(0.5, 1);
        this.dishes.set(key, img);
      }
      img.setTexture(w.tex).setPosition(w.x, w.y).setDepth(w.depth);
    }
    for (const [key, img] of this.dishes) {
      if (!want.has(key)) {
        img.destroy();
        this.dishes.delete(key);
      }
    }
  }

  /** Emote bubble above a guest's head: pops up, holds, fades. Follows the guest while visible. */
  showEmote(guestId: string, emote: GuestEmote): void {
    if (emote === 'hand') return; // shown as a state-driven bubble (syncBubbles)
    const target = this.characters.get(guestId);
    if (!target) return;
    const img = this.scene.add.image(0, 0, EMOTE_TEX[emote]).setOrigin(0.5, 1);
    const born = this.scene.time.now;
    let lastX = target.x;
    let lastY = target.y;
    this.effects.push({
      born,
      update: (now) => {
        const t = now - born;
        if (target.active) {
          lastX = target.x;
          lastY = target.y;
        }
        let dy = 0;
        let alpha = 1;
        if (t < EMOTE_POP_MS) {
          const k = t / EMOTE_POP_MS;
          dy = Math.round(6 * (1 - k));
          alpha = k < 0.3 ? 0 : 1; // hard pixel pop-in (no semi-transparent pixels)
        } else if (t > EMOTE_POP_MS + EMOTE_HOLD_MS) {
          const k = (t - EMOTE_POP_MS - EMOTE_HOLD_MS) / EMOTE_FADE_MS;
          dy = -Math.round(4 * k);
          alpha = 1 - k;
        }
        img
          .setPosition(Math.round(lastX), Math.round(lastY) - EMOTE_ABOVE_PX + dy)
          .setAlpha(Math.max(0, alpha))
          .setDepth(DEPTH_OVERLAY);
        return t < EMOTE_POP_MS + EMOTE_HOLD_MS + EMOTE_FADE_MS;
      },
      destroy: () => img.destroy(),
    });
  }

  /**
   * Coin plus "+N" floating up from the guest at tile (x, y). The text is rendered at the
   * camera's current zoom so it stays crisp instead of being a magnified bitmap.
   */
  showCoinPopup(x: number, y: number, amount: number): void {
    const o = tileToScreen(x + 0.5, y + 0.5);
    const baseX = Math.round(o.x);
    const baseY = Math.round(o.y) - COIN_ABOVE_PX;
    const zoom = this.scene.cameras.main.zoom;
    const text = this.scene.add
      .text(0, 0, `+${amount}`, {
        fontFamily: "'Archivo Black', Inter, system-ui, sans-serif",
        fontSize: `${COIN_TEXT_PX}px`,
        color: COIN_TEXT_COLOR,
        stroke: COIN_TEXT_STROKE,
        strokeThickness: 2,
        resolution: zoom,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_OVERLAY);
    const coin = this.scene.add.image(0, 0, COIN_TEX).setOrigin(0, 0.5).setDepth(DEPTH_OVERLAY);
    const gap = 2;
    const total = coin.width + gap + text.width;
    const born = this.scene.time.now;
    this.effects.push({
      born,
      update: (now) => {
        const t = now - born;
        const k = Math.min(1, t / COIN_MS);
        const rise = Math.round(COIN_RISE_PX * (1 - (1 - k) * (1 - k)));
        const fade = t > COIN_MS - COIN_FADE_MS ? (t - (COIN_MS - COIN_FADE_MS)) / COIN_FADE_MS : 0;
        const left = Math.round(baseX - total / 2);
        const yy = baseY - rise;
        coin.setPosition(left, yy).setAlpha(1 - fade);
        text.setPosition(left + coin.width + gap, yy).setAlpha(1 - fade);
        return t < COIN_MS;
      },
      destroy: () => {
        coin.destroy();
        text.destroy();
      },
    });
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

  /** Cold oven, or one of two flickering baking frames. */
  private ovenTexture(baking: boolean): string {
    if (!baking) return OVEN_TEX.off;
    return OVEN_TEX.bake[Math.floor(this.scene.time.now / OVEN_FLICKER_MS) % 2] ?? OVEN_TEX.off;
  }

  private syncFurniture(state: GameState): void {
    const live = new Set<string>();
    const baking = state.characters.some((c) => isStaff(c) && c.action === 'cook');
    for (const f of state.furniture) {
      live.add(f.id);
      const def = FURNITURE[f.defId];
      const [w, h] = rotatedFootprint(f.defId, f.rot);
      let img = this.furniture.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, f.defId);
        this.furniture.set(f.id, img);
      }
      if (def.kind === 'oven') img.setTexture(this.ovenTexture(baking));
      // The sprite's footprint top corner sits on the projected origin of tile (x, y).
      // rot 1 is the same sprite mirrored around that corner (flip happens around the origin).
      const o = tileToScreen(f.x, f.y);
      img
        .setOrigin(def.spriteOrigin[0] / img.width, def.spriteOrigin[1] / img.height)
        .setFlipX(f.rot === 1)
        .setPosition(o.x, o.y)
        .setDepth(depthKey(f.x + w - 1, f.y + h - 1) + DEPTH_FURNITURE_BIAS);
    }
    for (const [id, img] of this.furniture) {
      if (!live.has(id)) {
        img.destroy();
        this.furniture.delete(id);
      }
    }
  }
}
