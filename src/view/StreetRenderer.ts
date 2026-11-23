import Phaser from 'phaser';
import { EMOTE_TEX } from './textureKeys';
import { ART_ATLAS } from './art';
import { depthKey, tileToScreen } from './iso';
import { StreetLife, dogPosition, type Passerby, type StreetContext } from './street';
import { guestEntity, type WorldRenderer } from './WorldRenderer';
import { hasAnimalArea } from '../sim/street';
import type { GameState } from '../sim/state';

/** Colour of the leash (palette outline colour). */
const LEASH_COLOR = 0x2b1d16;
/** Leash ends: the walker's hand and the dog's collar, above their feet (px). */
const LEASH_HAND_PX = 8;
const LEASH_DOG_PX = 5;

interface Drawn {
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  dog?: Phaser.GameObjects.Sprite;
  dogShadow?: Phaser.GameObjects.Image;
}

/**
 * Draws the passers-by on the sidewalk (M12c): the view's own little crowd, driven by
 * `StreetLife`. Never touches the sim; paused with it.
 */
export class StreetRenderer {
  /** The passers-by (public for the ?debug hook and tests). */
  readonly life: StreetLife;
  private readonly drawn = new Map<number, Drawn>();
  private readonly leash: Phaser.GameObjects.Graphics;
  /** One graphics object draws every leash: it sits in front of the frontmost dog. */
  private leashDepth = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldRenderer,
    seed: number,
  ) {
    this.life = new StreetLife(seed);
    this.life.onDogTurnedAway = (p) => this.turnedAway(p);
    this.leash = scene.add.graphics();
  }

  /** The dog walker finds no place for the dog: a broken heart above their head. */
  private turnedAway(p: Passerby): void {
    const d = this.drawn.get(p.id);
    if (d) this.world.emoteOn(d.body, EMOTE_TEX.brokenHeart);
  }

  /** Advances the street by `dtSec` (0 while the game is paused) and redraws it. */
  update(dtSec: number, state: GameState): void {
    const ctx: StreetContext = {
      open: state.clock.phase === 'open' || state.clock.phase === 'closing',
      minuteOfDay: state.clock.minuteOfDay,
      animalArea: hasAnimalArea(state.furniture),
    };
    this.life.update(dtSec, ctx);
    this.leash.clear();
    this.leash.lineStyle(1, LEASH_COLOR, 1);
    this.leashDepth = 0;
    this.sync();
    this.leash.setDepth(this.leashDepth);
  }

  private sync(): void {
    const live = new Set<number>();
    for (const w of this.life.walkers) {
      live.add(w.id);
      const d = this.drawn.get(w.id) ?? this.create(w);
      this.place(w, d);
    }
    for (const [id, d] of this.drawn) {
      if (live.has(id)) continue;
      d.body.destroy();
      d.shadow.destroy();
      d.dog?.destroy();
      d.dogShadow?.destroy();
      this.drawn.delete(id);
    }
  }

  private create(w: Passerby): Drawn {
    const body = this.scene.add
      .sprite(0, 0, ART_ATLAS, `${guestEntity(w.variant)}_idle_front_0`)
      .setOrigin(0.5, 1);
    const shadow = this.scene.add.image(0, 0, ART_ATLAS, 'shadow_still_none_0');
    const d: Drawn = { body, shadow };
    if (w.dog !== null) {
      d.dog = this.scene.add
        .sprite(0, 0, ART_ATLAS, `${w.dog === 0 ? 'dog' : 'dog1'}_idle_front_0`)
        .setOrigin(0.5, 1);
      d.dogShadow = this.scene.add.image(0, 0, ART_ATLAS, 'shadow_still_none_0').setScale(0.7);
    }
    this.drawn.set(w.id, d);
    return d;
  }

  /** Front = down-right (+x), back = up-left (-x, mirrored). */
  private pose(sprite: Phaser.GameObjects.Sprite, entity: string, anim: string, dir: 1 | -1): void {
    const facing = dir === 1 ? 'front' : 'back';
    let key = `${entity}_${anim}_${facing}`;
    if (!this.scene.anims.exists(key)) key = `${entity}_idle_${facing}`;
    sprite.setFlipX(dir === -1).play(key, true);
  }

  private place(w: Passerby, d: Drawn): void {
    const moving = w.stopLeft <= 0;
    const o = tileToScreen(w.x + 0.5, w.y + 0.5);
    d.body.setPosition(Math.round(o.x), Math.round(o.y) + 1).setDepth(depthKey(w.x, w.y));
    this.pose(d.body, guestEntity(w.variant), moving ? 'walk' : 'idle', w.dir);
    d.shadow.setPosition(d.body.x, Math.round(o.y) - 1).setDepth(d.body.depth - 0.02);
    if (!d.dog || !d.dogShadow || w.dog === null) return;
    const p = dogPosition(w);
    const q = tileToScreen(p.x + 0.5, p.y + 0.5);
    d.dog.setPosition(Math.round(q.x), Math.round(q.y) + 1).setDepth(depthKey(p.x, p.y));
    this.pose(d.dog, w.dog === 0 ? 'dog' : 'dog1', moving ? 'walk' : 'idle', w.dir);
    d.dogShadow.setPosition(d.dog.x, Math.round(q.y) - 1).setDepth(d.dog.depth - 0.02);
    // The leash: hand to collar.
    this.leash.lineBetween(d.body.x, d.body.y - LEASH_HAND_PX, d.dog.x, d.dog.y - LEASH_DOG_PX);
    this.leashDepth = Math.max(this.leashDepth, d.dog.depth + 0.01, d.body.depth + 0.01);
  }
}
