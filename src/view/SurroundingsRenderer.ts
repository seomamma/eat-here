import Phaser from 'phaser';
import {
  SURROUNDINGS,
  groundKind,
  groundRect,
  surroundingProps,
  type SurroundingProp,
} from '../data/surroundings';
import type { Room } from '../data/layout';
import { depthKey, tileToScreen, type Bounds } from './iso';
import { GROUND_TEX, PROP_TEX } from './surroundingsTextures';
import { DEPTH_BACK_WALL, DEPTH_FLOOR } from './WorldRenderer';

/** Ground sits below the room's floors; flat decals (flowers) just above it. */
const DEPTH_GROUND = DEPTH_FLOOR - 1;
const DEPTH_DECAL = DEPTH_FLOOR + 1;
/** Boxes sort like furniture: a bit behind things standing on the same diagonal. */
const DEPTH_BOX_BIAS = -0.1;

/**
 * Draws the outdoor decoration from `src/data/surroundings.ts` around the room rectangle. It is
 * not part of the sim grid; it is laid out again whenever the room grows. Everything is drawn in
 * the world layer, so the night veil (a UI overlay) darkens it with the room.
 */
export class SurroundingsRenderer {
  private room: Room | null = null;
  private objects: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Builds the ring around `room`; does nothing while the room is unchanged. */
  sync(room: Readonly<Room>): void {
    const r = this.room;
    if (r && r.x0 === room.x0 && r.y0 === room.y0 && r.x1 === room.x1 && r.y1 === room.y1) return;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.room = { ...room };
    this.buildGround(this.room);
    for (const p of surroundingProps(this.room)) this.buildProp(p, this.room);
  }

  /** True for props that stand behind the room's back walls (they sort with the back-wall layer). */
  private static isBehindWalls(room: Room, x: number, y: number): boolean {
    return (x < room.x0 && y <= room.y1) || (y < room.y0 && x <= room.x1 + 1);
  }

  /** Camera pan bounds: the room plus a margin of the surroundings (art px). */
  static panBounds(room: Bounds): Bounds {
    const m = SURROUNDINGS.cameraMarginPx;
    return {
      minX: room.minX - m.left,
      maxX: room.maxX + m.right,
      minY: room.minY - m.top,
      maxY: room.maxY + m.bottom,
    };
  }

  private buildGround(room: Room): void {
    const { x0, x1, y0, y1 } = groundRect(room);
    const extra = SURROUNDINGS.roadExtra;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0 - extra; x <= x1 + extra; x++) {
        const kind = groundKind(room, x, y);
        if (!kind) continue;
        const variants = GROUND_TEX[kind];
        const key = variants[Math.abs(x * 3 + y * 5) % variants.length] ?? variants[0];
        if (!key) continue;
        const o = tileToScreen(x, y);
        this.objects.push(
          this.scene.add
            .image(o.x - 16, o.y, key)
            .setOrigin(0, 0)
            .setDepth(DEPTH_GROUND),
        );
      }
    }
  }

  private buildProp(p: SurroundingProp, room: Room): void {
    const t = PROP_TEX[p.kind];
    const flat = p.kind.startsWith('flower');
    if (t.corner) {
      const o = tileToScreen(p.x, p.y);
      const img = this.scene.add.image(o.x, o.y, t.key);
      // Origin is the footprint's top corner inside the sprite (furniture convention).
      img.setOrigin(t.originX / img.width, t.originY / img.height);
      img.setDepth(this.depth(room, p.x + t.w - 1, p.y + t.h - 1) + DEPTH_BOX_BIAS);
      this.objects.push(img);
      return;
    }
    const o = tileToScreen(p.x + 0.5, p.y + 0.5);
    const img = this.scene.add.image(Math.round(o.x), Math.round(o.y), t.key);
    img.setOrigin(t.originX / img.width, (t.originY + 1) / img.height);
    img.setDepth(flat ? DEPTH_DECAL : this.depth(room, p.x, p.y));
    this.objects.push(img);
  }

  private depth(room: Room, x: number, y: number): number {
    return (SurroundingsRenderer.isBehindWalls(room, x, y) ? DEPTH_BACK_WALL : 0) + depthKey(x, y);
  }
}
