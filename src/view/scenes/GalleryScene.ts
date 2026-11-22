import Phaser from 'phaser';
import { ART_ATLAS, artEntities, preloadArt, type ArtEntity } from '../art';

/** Background the sprites are judged on: the world's ground colour. */
const BG = 0x6fae4e;
const SCALES = [1, 2, 4] as const;
const GAP = 10;
const MARGIN = 8;

/**
 * Dev page (?gallery[=prefix,prefix]): every sprite and animation of the atlas at 1x, 2x and 4x on
 * the world background. Drag or scroll to move. Used for art review (ART_DIRECTION §7 step 10).
 */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('GalleryScene');
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(BG);
    const zoom = Math.max(2, Math.floor(this.scale.width / 400));
    cam.setZoom(zoom);
    const viewW = this.scale.width / zoom;
    const filter = (new URLSearchParams(location.search).get('gallery') ?? '')
      .split(',')
      .filter(Boolean);
    const entities = Object.entries(artEntities(this)).filter(
      ([name]) => filter.length === 0 || filter.some((f) => name === f || name.startsWith(f)),
    );
    let x = MARGIN;
    let y = MARGIN;
    let rowH = 0;
    for (const [name, e] of entities) {
      for (const [animName, anim] of Object.entries(e.anims)) {
        const w = SCALES.reduce((sum, s) => sum + e.w * s + GAP, 0);
        const h = e.h * 4 + 12;
        if (x + w > viewW - MARGIN && x > MARGIN) {
          x = MARGIN;
          y += rowH + GAP;
          rowH = 0;
        }
        this.cell(name, animName, e, anim.fps, anim.frames, x, y);
        x += w + GAP;
        rowH = Math.max(rowH, h);
      }
    }
    const total = y + rowH + MARGIN;
    cam.setBounds(0, 0, viewW, Math.max(total, this.scale.height / zoom));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) cam.scrollY -= (p.y - p.prevPosition.y) / zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY += dy / zoom;
    });
  }

  private cell(
    entity: string,
    animName: string,
    e: ArtEntity,
    fps: number,
    frames: string[],
    x0: number,
    y0: number,
  ): void {
    this.add
      .text(x0, y0, `${entity} ${animName}`, { fontSize: '6px', color: '#ffffff', resolution: 4 })
      .setOrigin(0, 0);
    let x = x0;
    const baseY = y0 + 10 + e.h * 4;
    for (const s of SCALES) {
      const img = this.add.image(x, baseY, ART_ATLAS, frames[0]).setOrigin(0, 1).setScale(s);
      if (frames.length > 1) {
        let i = 0;
        this.time.addEvent({
          delay: 1000 / fps,
          loop: true,
          callback: () => img.setFrame(frames[++i % frames.length] as string),
        });
      }
      x += e.w * s + GAP;
    }
  }
}
