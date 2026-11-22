import Phaser from 'phaser';
import { DOOR_X } from '../data/layout';
import { FURNITURE } from '../data/furniture';
import { isGuest, isStaff, type Character, type IsoDir } from '../sim/characters';
import type { GuestEmote } from '../sim/events';
import { footprintTiles, furnitureAt, rotatedFootprint, tileAt, type Furniture } from '../sim/grid';
import type { GameState } from '../sim/state';
import { prefersReducedMotion } from '../platform/motion';
import { depthKey, tileRectBounds, tileToScreen, type Bounds, type Point } from './iso';
import { interpolatePosition } from './interpolate';
import { SPARKLE_FRAME_COUNT, levelTextureKey } from './levelTextures';
import { floorStyleAt, wallStyleOf } from '../sim/systems/surfaces';
import { coinRise, squash } from './juice';
import { ART_ATLAS, artEntities } from './art';
import {
  COIN_TEX,
  DISH_TEX,
  EMOTE_TEX,
  MARKER_TEX,
  OVEN_EXTRA_TEX,
  WOODPILE_H,
  CHAR_H,
  CHAR_W,
  ORDER_BUBBLE_TEX,
  OVEN_TEX,
  SPARKLE_TEX,
  TEX,
  WALL_BACK_RISE,
  floorTexKey,
  furnitureTexKey,
  isMirroredRot,
  wallTexKey,
  type CharFacing,
} from './placeholderTextures';

/** Floors sit below everything; back walls are never in front of anything. */
export const DEPTH_FLOOR = -20000;
export const DEPTH_BACK_WALL = -10000;
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
/** Oven level visuals: woodpile from this level, copper collar from this one. */
const OVEN_WOOD_FROM_LEVEL = 3;
const OVEN_COPPER_FROM_LEVEL = 5;
/** The woodpile's feet sit this far below the tile centre (px). */
const WOODPILE_DROP_PX = Math.floor(WOODPILE_H / 3);
/** Lv.5 sparkle: time between its two positions. */
const SPARKLE_BLINK_MS = 650;
/** Oven flicker period while baking. */
const OVEN_FLICKER_MS = 220;

/** Front = down-right, back = up-right; the other two directions mirror them. */
const DIR_VIEW: Record<IsoDir, { facing: CharFacing; flip: boolean }> = {
  dr: { facing: 'front', flip: false },
  dl: { facing: 'front', flip: true },
  ur: { facing: 'back', flip: false },
  ul: { facing: 'back', flip: true },
};

function animKey(entity: string, anim: string, facing: CharFacing): string {
  return `${entity}_${anim}_${facing}`;
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

/** Atlas entity of a character: staff by role, named guests by look, others by body variant. */
function entityOf(c: Character): string {
  if (isStaff(c)) return c.role;
  if (isGuest(c)) {
    if (c.look) return c.look;
    return c.variant % GUEST_VARIANTS === 0 ? 'guest' : `guest${c.variant % GUEST_VARIANTS}`;
  }
  return 'guest';
}
/** Palette-swapped guest bodies (guest, guest1..guest3). */
const GUEST_VARIANTS = 4;

/** Chef at the oven: share of the cook time spent sliding the pizza in / taking it out. */
const BAKE_SHARE = 0.25;
const TAKE_SHARE = 0.2;
/** In between, the chef stokes the fire for STOKE_TICKS every STOKE_PERIOD_TICKS. */
const STOKE_TICKS = 12;
const STOKE_PERIOD_TICKS = 50;

/** Short-lived world effects (emote bubbles, coin popups), animated from scene time. */
const EMOTE_POP_MS = 180;
const EMOTE_HOLD_MS = 1100;
const EMOTE_FADE_MS = 400;
const EMOTE_ABOVE_PX = 30;
/** The zzz bubble sits beside the persistent hand/dish bubble instead of covering it. */
const EMOTE_SLOW_SIDE_PX = 18;
/** Selection marker: gap above the head and bob period. */
const MARKER_ABOVE_PX = 25;
const MARKER_BOB_MS = 300;
/** Extra touch margin (art px) around a guest sprite for tap selection. */
const TAP_PAD_PX = 3;
/** Coin popup arc: sideways drift (px). */
const COIN_ARC_PX = 6;
/** Hop of a guest or waiter when a dish is served. */
const HOP_MS = 260;
const HOP_PX = 3;
/** Sparkle burst: count, flight time, travel distance range (px). */
const SPARKLE_COUNT = 8;
const SPARKLE_MS = 750;
const SPARKLE_REACH_PX = [8, 16] as const;
const SPARKLE_STATIC_MS = 500;
/** Sparkle anchors above a guest's feet and above the oven's footprint centre (px). */
const SPARKLE_ABOVE_PX = 14;
const OVEN_SPARKLE_ABOVE_PX = 16;
const FURNITURE_SPARKLE_ABOVE_PX = 10;
/** A waiter this close (px) to a served guest joins the hop. */
const SERVE_HOP_RANGE_PX = 40;
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
  /** Soft shadow under each character, and the cook time (ticks) a chef started with. */
  private readonly shadows = new Map<string, Phaser.GameObjects.Image>();
  private readonly cookTotals = new Map<string, number>();
  /** Floor tile images ("x,y") and back-wall segment images, restyled when the player paints. */
  private readonly floorImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly wallImages = new Map<
    string,
    { img: Phaser.GameObjects.Image; side: 'l' | 'r'; end: boolean }
  >();
  /** Piece being moved: hidden while its ghost is shown. */
  private hiddenFurnitureId: string | null = null;
  private highlight: Phaser.GameObjects.Image | null = null;
  private marker: Phaser.GameObjects.Image | null = null;
  private effects: Effect[] = [];
  /** Characters currently hopping: id -> birth time (scene ms). */
  private readonly hops = new Map<string, number>();
  /** Persistent state-driven overlays: status bubbles above guests and dish icons. */
  private readonly bubbles = new Map<string, Phaser.GameObjects.Image>();
  private readonly dishes = new Map<string, Phaser.GameObjects.Image>();
  /** Oven level extras: woodpile (Lv.3+) and copper collar (Lv.5), keyed by oven id. */
  private readonly ovenExtras = new Map<
    string,
    { wood: Phaser.GameObjects.Image; copper: Phaser.GameObjects.Image }
  >();

  constructor(private readonly scene: Phaser.Scene) {
    this.createAnimations();
  }

  /** One Phaser animation per atlas character entity and facing (from the anim manifest). */
  private createAnimations(): void {
    for (const [entity, e] of Object.entries(artEntities(this.scene))) {
      if (e.kind !== 'character') continue;
      for (const [name, a] of Object.entries(e.anims)) {
        const m = /^(.*)_(front|back)$/.exec(name);
        if (!m) continue;
        const key = animKey(entity, m[1] as string, m[2] as CharFacing);
        if (this.scene.anims.exists(key)) continue;
        this.scene.anims.create({
          key,
          frames: a.frames.map((frame) => ({ key: ART_ATLAS, frame })),
          frameRate: a.fps,
          repeat: a.loop ? -1 : 0,
        });
      }
    }
  }

  /** Animation name of a character right now (falls back to idle when the entity lacks it). */
  private animOf(c: Character): string {
    if (isStaff(c)) {
      if (c.path.length > 0) return c.carrying ? 'carry' : 'walk';
      if (c.phase === 'working' && c.action === 'cook') return this.cookAnim(c);
      this.cookTotals.delete(c.id);
      if (c.phase === 'working' && c.action === 'takeOrder') return 'order';
      return 'idle';
    }
    if (c.path.length > 0) return 'walk';
    if (isGuest(c)) {
      if (c.phase === 'eating') return 'eat';
      if (c.phase === 'wantsToOrder') return 'hand';
      if (c.phase === 'browsing' || c.phase === 'waitingForFood' || c.phase === 'paying')
        return 'sit';
    }
    return 'idle';
  }

  /** Chef baking: slide the pizza in, stoke now and then, take it out at the end. */
  private cookAnim(c: Character & { timer: number }): string {
    const total = Math.max(this.cookTotals.get(c.id) ?? 0, c.timer);
    this.cookTotals.set(c.id, total);
    const done = total - c.timer;
    if (done < total * BAKE_SHARE) return 'bake';
    if (c.timer <= total * TAKE_SHARE) return 'take';
    const t = done - total * BAKE_SHARE;
    return t % STOKE_PERIOD_TICKS < STOKE_TICKS ? 'stoke' : 'idle';
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

  setHiddenFurniture(id: string | null): void {
    this.hiddenFurnitureId = id;
  }

  sync(state: GameState): void {
    if (!this.tilesBuilt) {
      this.buildTiles(state);
      this.tilesBuilt = true;
    }
    this.syncSurfaces(state);
    this.syncFurniture(state);
    this.syncOvenExtras(state);
  }

  /**
   * Oven level visuals: from Lv.3 a small woodpile stands on the free floor tile beyond the
   * oven's long end (hidden when that tile is taken); at Lv.5 a copper collar sits on the chimney.
   */
  private syncOvenExtras(state: GameState): void {
    const live = new Set<string>();
    for (const f of state.furniture) {
      if (FURNITURE[f.defId].kind !== 'oven' || f.level < OVEN_WOOD_FROM_LEVEL) continue;
      live.add(f.id);
      let extras = this.ovenExtras.get(f.id);
      if (!extras) {
        extras = {
          wood: this.scene.add.image(0, 0, OVEN_EXTRA_TEX.woodpile).setOrigin(0.5, 1),
          copper: this.scene.add.image(0, 0, OVEN_EXTRA_TEX.copper),
        };
        this.ovenExtras.set(f.id, extras);
      }
      const [w, h] = rotatedFootprint(f.defId, f.rot);
      // The tile just past the long end, on the side the piece's rotation points to.
      const step = [
        { x: w, y: 0 },
        { x: 0, y: h },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
      ][f.rot] as { x: number; y: number };
      const tx = f.x + step.x;
      const ty = f.y + step.y;
      const t = tileAt(state.grid, tx, ty);
      const free =
        (t === 'floor_wood' || t === 'floor_tile') && furnitureAt(state, tx, ty) === undefined;
      const o = tileToScreen(tx + 0.5, ty + 0.5);
      extras.wood
        .setPosition(Math.round(o.x), Math.round(o.y) + WOODPILE_DROP_PX)
        .setDepth(depthKey(tx, ty) + DEPTH_FURNITURE_BIAS)
        .setVisible(free && f.id !== this.hiddenFurnitureId);
      const base = this.furniture.get(f.id);
      extras.copper
        .setVisible(f.level >= OVEN_COPPER_FROM_LEVEL && f.rot < 2 && !!base && base.visible)
        .setOrigin(base?.originX ?? 0, base?.originY ?? 0)
        .setFlipX(isMirroredRot(f.rot))
        .setPosition(base?.x ?? 0, base?.y ?? 0)
        .setDepth((base?.depth ?? 0) + 0.01);
    }
    for (const [id, e] of this.ovenExtras) {
      if (!live.has(id)) {
        e.wood.destroy();
        e.copper.destroy();
        this.ovenExtras.delete(id);
      }
    }
  }

  /** Re-skins floors and back walls that were painted (cheap: one texture key compare each). */
  private syncSurfaces(state: GameState): void {
    for (const [key, img] of this.floorImages) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      const want = floorTexKey(floorStyleAt(state, x, y), x, y);
      if (img.texture.key !== want) img.setTexture(want);
    }
    for (const [id, w] of this.wallImages) {
      const want = wallTexKey(w.side, w.end, wallStyleOf(state, id));
      if (w.img.texture.key !== want) w.img.setTexture(want);
    }
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
          .sprite(0, 0, ART_ATLAS, `${entityOf(c)}_idle_front_0`)
          .setOrigin(0.5, 1);
        this.characters.set(c.id, sprite);
        this.shadows.set(
          c.id,
          this.scene.add.image(0, 0, ART_ATLAS, 'shadow_still_none_0').setOrigin(0.5, 0.5),
        );
      }
      const p = interpolatePosition(c, alpha);
      // Tile (x, y) has its diamond centre at tileToScreen(x + 0.5, y + 0.5).
      const o = tileToScreen(p.x + 0.5, p.y + 0.5);
      const view = DIR_VIEW[c.dir];
      const anim = this.animOf(c);
      const seated = anim === 'sit' || anim === 'eat' || anim === 'hand';
      sprite
        .setPosition(
          Math.round(o.x),
          Math.round(o.y) + 1 - (seated ? SEATED_LIFT_PX : 0) - this.hopOffset(c.id),
        ) // feet row sits on the centre pixel
        .setFlipX(view.flip)
        .setDepth(depthKey(p.x, p.y) + (seated ? DEPTH_SEATED_BIAS : 0));
      const entity = entityOf(c);
      let key = animKey(entity, anim, view.facing);
      if (!this.scene.anims.exists(key)) key = animKey(entity, 'idle', view.facing);
      sprite.play(key, true);
      this.shadows
        .get(c.id)
        ?.setPosition(sprite.x, Math.round(o.y) - 1)
        .setVisible(!seated)
        .setDepth(sprite.depth - 0.02);
    }
    for (const [id, sprite] of this.characters) {
      if (!live.has(id)) {
        sprite.destroy();
        this.characters.delete(id);
        this.shadows.get(id)?.destroy();
        this.shadows.delete(id);
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

  /** Shows a bobbing arrow above the selected guest; null (or a missing guest) hides it. */
  syncSelection(guestId: string | null): void {
    const sprite = guestId ? this.characters.get(guestId) : undefined;
    if (!sprite) {
      this.marker?.setVisible(false);
      return;
    }
    this.marker ??= this.scene.add.image(0, 0, MARKER_TEX).setOrigin(0.5, 1);
    const bob = Math.floor(this.scene.time.now / MARKER_BOB_MS) % 2;
    this.marker
      .setPosition(Math.round(sprite.x), Math.round(sprite.y) - MARKER_ABOVE_PX - bob)
      .setDepth(DEPTH_OVERLAY + 1)
      .setVisible(true);
  }

  /** Frontmost guest under a world point (sprite box plus a touch margin), or null. */
  guestAt(state: GameState, wx: number, wy: number): string | null {
    let best: { id: string; depth: number } | null = null;
    for (const c of state.characters) {
      if (!isGuest(c)) continue;
      const sprite = this.characters.get(c.id);
      if (!sprite) continue;
      const inX = Math.abs(wx - sprite.x) <= CHAR_W / 2 + TAP_PAD_PX;
      const inY = wy >= sprite.y - CHAR_H - TAP_PAD_PX && wy <= sprite.y + TAP_PAD_PX;
      if (inX && inY && (!best || sprite.depth > best.depth)) {
        best = { id: c.id, depth: sprite.depth };
      }
    }
    return best?.id ?? null;
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
    const side = emote === 'slow' ? EMOTE_SLOW_SIDE_PX : 0;
    const reduced = prefersReducedMotion();
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
        let sx = 1;
        let sy = 1;
        if (t < EMOTE_POP_MS) {
          const k = t / EMOTE_POP_MS;
          if (!reduced) {
            dy = Math.round(6 * (1 - k));
            [sx, sy] = squash(k);
          }
          alpha = k < 0.3 ? 0 : 1; // hard pixel pop-in (no semi-transparent pixels)
        } else if (t > EMOTE_POP_MS + EMOTE_HOLD_MS) {
          const k = (t - EMOTE_POP_MS - EMOTE_HOLD_MS) / EMOTE_FADE_MS;
          dy = -Math.round(4 * k);
          alpha = 1 - k;
        }
        img
          .setPosition(Math.round(lastX) + side, Math.round(lastY) - EMOTE_ABOVE_PX + dy)
          .setScale(sx, sy)
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
    const reduced = prefersReducedMotion();
    // Alternate the drift side by tile so neighbouring popups do not overlap.
    const side = (x + y) % 2 === 0 ? 1 : -1;
    const born = this.scene.time.now;
    this.effects.push({
      born,
      update: (now) => {
        const t = now - born;
        const k = Math.min(1, t / COIN_MS);
        // Reduced motion: no flight, the popup just sits there and fades.
        const rise = reduced ? 0 : coinRise(k);
        const drift = reduced ? 0 : Math.round(side * COIN_ARC_PX * (1 - (1 - k) * (1 - k)));
        const fade = t > COIN_MS - COIN_FADE_MS ? (t - (COIN_MS - COIN_FADE_MS)) / COIN_FADE_MS : 0;
        const left = Math.round(baseX - total / 2) + drift;
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

  /** Makes a guest or waiter hop once (a happy little jump); skipped with reduced motion. */
  hop(id: string): void {
    if (prefersReducedMotion() || !this.characters.has(id)) return;
    this.hops.set(id, this.scene.time.now);
  }

  /** Pixels a character is lifted right now (0 when not hopping). */
  private hopOffset(id: string): number {
    const born = this.hops.get(id);
    if (born === undefined) return 0;
    const k = (this.scene.time.now - born) / HOP_MS;
    if (k >= 1) {
      this.hops.delete(id);
      return 0;
    }
    return Math.round(HOP_PX * Math.sin(Math.PI * k));
  }

  /** The dish reached a guest: the guest and the waiter next to them hop. */
  hopOnServe(state: GameState, guestId: string): void {
    this.hop(guestId);
    const guest = this.characters.get(guestId);
    if (!guest) return;
    for (const c of state.characters) {
      const sprite = this.characters.get(c.id);
      if (!isStaff(c) || c.role !== 'waiter' || !sprite) continue;
      if (Math.hypot(sprite.x - guest.x, sprite.y - guest.y) <= SERVE_HOP_RANGE_PX) this.hop(c.id);
    }
  }

  /** A few pixel sparkles flying out from a screen point (world px); static with reduced motion. */
  showSparkles(wx: number, wy: number): void {
    const reduced = prefersReducedMotion();
    const born = this.scene.time.now;
    const parts = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (i % 2) * 0.4;
      const reach = SPARKLE_REACH_PX[i % 2] ?? SPARKLE_REACH_PX[0];
      const img = this.scene.add
        .image(0, 0, i % 2 === 0 ? SPARKLE_TEX.large : SPARKLE_TEX.small)
        .setDepth(DEPTH_OVERLAY);
      return { img, angle, reach, delay: (i % 4) * 40 };
    });
    this.effects.push({
      born,
      update: (now) => {
        const t = now - born;
        const life = reduced ? SPARKLE_STATIC_MS : SPARKLE_MS;
        for (const p of parts) {
          const k = Math.max(0, Math.min(1, (t - (reduced ? 0 : p.delay)) / life));
          const out = reduced ? p.reach * 0.6 : p.reach * (1 - (1 - k) * (1 - k));
          const fall = reduced ? 0 : 5 * k * k; // drifts down a little as it fades
          // Blink the last third out (hard on/off keeps the pixels crisp).
          const visible = k < 0.65 || Math.floor(t / 70) % 2 === 0;
          p.img
            .setPosition(
              Math.round(wx + Math.cos(p.angle) * out),
              Math.round(wy + Math.sin(p.angle) * out * 0.6 + fall),
            )
            .setVisible(t >= (reduced ? 0 : p.delay) && visible);
        }
        return t < (reduced ? SPARKLE_STATIC_MS : SPARKLE_MS + 200);
      },
      destroy: () => parts.forEach((p) => p.img.destroy()),
    });
  }

  /** Sparkles over a guest's head (gifts). */
  sparklesAtGuest(guestId: string): void {
    const sprite = this.characters.get(guestId);
    if (sprite) this.showSparkles(Math.round(sprite.x), Math.round(sprite.y) - SPARKLE_ABOVE_PX);
  }

  /** Sparkles at the pizza oven (a recipe levelled up in the kitchen). */
  sparklesAtOven(state: GameState): void {
    const oven = state.furniture.find((f) => f.defId === 'oven_pizza');
    if (!oven) return;
    const [w, h] = rotatedFootprint(oven.defId, oven.rot);
    const o = tileToScreen(oven.x + w / 2, oven.y + h / 2);
    this.showSparkles(Math.round(o.x), Math.round(o.y) - OVEN_SPARKLE_ABOVE_PX);
  }

  /** Sparkles over a furniture piece (it just levelled up). */
  sparklesAtFurniture(state: GameState, id: string): void {
    const f = state.furniture.find((o) => o.id === id);
    if (!f) return;
    const [w, h] = rotatedFootprint(f.defId, f.rot);
    const o = tileToScreen(f.x + w / 2, f.y + h / 2);
    this.showSparkles(Math.round(o.x), Math.round(o.y) - FURNITURE_SPARKLE_ABOVE_PX);
  }

  /** World-space box of a placed piece's sprite, or null when it is not drawn. */
  furnitureBounds(id: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const img = this.furniture.get(id);
    if (!img) return null;
    const b = img.getBounds();
    return { minX: b.x, minY: b.y, maxX: b.right, maxY: b.bottom };
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
  private put(x: number, y: number, key: string, depth: number): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, key).setOrigin(0, 0).setDepth(depth);
  }

  private buildTiles(state: GameState): void {
    const { width, height, tiles } = state.grid;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y * width + x];
        const o = tileToScreen(x, y);
        switch (tile) {
          case 'floor_wood':
          case 'floor_tile':
            this.floorImages.set(
              `${x},${y}`,
              this.put(o.x - 16, o.y, floorTexKey(floorStyleAt(state, x, y), x, y), DEPTH_FLOOR),
            );
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
      const id = `l${y}`;
      this.wallImages.set(id, {
        img: this.put(
          -16 * y,
          8 * y - 33,
          wallTexKey('l', end, wallStyleOf(state, id)),
          DEPTH_BACK_WALL + depthKey(x, y),
        ),
        side: 'l',
        end,
      });
    } else if (y === 0 && x >= 1 && x <= width - 2) {
      // Back-right wall, standing on the top-right edge of tile (x, 1).
      const end = x === width - 2;
      const id = `r${x}`;
      this.wallImages.set(id, {
        img: this.put(
          16 * x - 16,
          8 * x - 33,
          wallTexKey('r', end, wallStyleOf(state, id)),
          DEPTH_BACK_WALL + depthKey(x, y),
        ),
        side: 'r',
        end,
      });
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
    const sparkleFrame = prefersReducedMotion()
      ? 0
      : Math.floor(this.scene.time.now / SPARKLE_BLINK_MS) % SPARKLE_FRAME_COUNT;
    for (const f of state.furniture) {
      live.add(f.id);
      const def = FURNITURE[f.defId];
      const [w, h] = rotatedFootprint(f.defId, f.rot);
      let img = this.furniture.get(f.id);
      if (!img) {
        img = this.scene.add.image(0, 0, f.defId);
        this.furniture.set(f.id, img);
      }
      // Rot 0/1 show the front, 2/3 the back; the oven only glows when seen from the front.
      // Higher levels get a gold trim (Lv.3+) and a blinking sparkle (Lv.5).
      const base =
        def.kind === 'oven' && f.rot < 2
          ? this.ovenTexture(baking)
          : furnitureTexKey(f.defId, f.rot);
      img.setTexture(levelTextureKey(this.scene.textures, base, f.level, sparkleFrame));
      // The sprite's footprint top corner sits on the projected origin of tile (x, y).
      // Odd rotations are the same sprite mirrored around that corner (flip is around the origin).
      const o = tileToScreen(f.x, f.y);
      img
        .setOrigin(def.spriteOrigin[0] / img.width, def.spriteOrigin[1] / img.height)
        .setFlipX(isMirroredRot(f.rot))
        .setPosition(o.x, o.y)
        .setVisible(f.id !== this.hiddenFurnitureId)
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
