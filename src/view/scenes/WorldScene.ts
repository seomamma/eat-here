import Phaser from 'phaser';

const CANVAS_COLOR = 0xf6f3ee;
const WOOD = 0xb9824f;
const OUTLINE = 0x2b1d16;
const PLACEHOLDER_W = 160;
const PLACEHOLDER_H = 192;
const MARGIN = 16;

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CANVAS_COLOR);

    // Placeholder room: 160x192 world px centered on origin, with a 1px outline.
    const g = this.add.graphics();
    g.fillStyle(OUTLINE, 1);
    g.fillRect(
      -PLACEHOLDER_W / 2 - 1,
      -PLACEHOLDER_H / 2 - 1,
      PLACEHOLDER_W + 2,
      PLACEHOLDER_H + 2,
    );
    g.fillStyle(WOOD, 1);
    g.fillRect(-PLACEHOLDER_W / 2, -PLACEHOLDER_H / 2, PLACEHOLDER_W, PLACEHOLDER_H);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
    });
    this.fit();
  }

  /** Largest integer zoom at which the placeholder (plus margin) fits the viewport. */
  private fit(): void {
    const { width, height } = this.scale;
    const zoom = Math.max(
      1,
      Math.floor(
        Math.min(
          (width - MARGIN * 2) / (PLACEHOLDER_W + 2),
          (height - MARGIN * 2) / (PLACEHOLDER_H + 2),
        ),
      ),
    );
    const cam = this.cameras.main;
    cam.setSize(width, height);
    cam.setZoom(zoom);
    cam.centerOn(0, 0);
  }
}
