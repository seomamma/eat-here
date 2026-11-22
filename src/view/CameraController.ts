import Phaser from 'phaser';

/** Screen space (CSS px) reserved for UI overlays; the room is fitted into what remains. */
export const HUD_INSETS = { top: 96, bottom: 80, left: 0, right: 0 } as const;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
/** Wheel delta (px) that amounts to one zoom step. */
const WHEEL_STEP = 60;
/** Pointer travel (CSS px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

interface Size {
  width: number;
  height: number;
}

/**
 * Pan (drag), zoom (pinch / wheel) with integer zoom only, clamped to the room.
 *
 * The camera origin is the top-left corner, so a world point maps to the screen
 * as `world * zoom + offset`. Offsets are kept integer, which keeps every
 * world pixel an exact `zoom x zoom` block of CSS pixels.
 */
export class CameraController {
  private zoom = MIN_ZOOM;
  private offsetX = 0;
  private offsetY = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dragging = false;
  private dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  private pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;
  private wheelAccum = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: Size,
  ) {
    this.cam = scene.cameras.main;
    this.cam.setOrigin(0, 0);
    this.canvas = scene.game.canvas;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.fit();
  }

  get currentZoom(): number {
    return this.zoom;
  }

  /** Re-fits the room into the available area (also on resize / rotation). */
  fit(): void {
    const { width, height } = this.scene.scale;
    this.cam.setSize(width, height);
    const a = this.available();
    const z = Math.floor(Math.min(a.width / this.world.width, a.height / this.world.height));
    this.zoom = clampZoom(z);
    // Centre in the available area.
    this.offsetX = a.left + (a.width - this.world.width * this.zoom) / 2;
    this.offsetY = a.top + (a.height - this.world.height * this.zoom) / 2;
    this.apply();
  }

  private destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
  }

  private available() {
    const { width, height } = this.scene.scale;
    const left = HUD_INSETS.left;
    const top = HUD_INSETS.top;
    return {
      left,
      top,
      width: Math.max(1, width - left - HUD_INSETS.right),
      height: Math.max(1, height - top - HUD_INSETS.bottom),
    };
  }

  /** Clamps the offset to the room bounds, rounds to whole pixels and updates the camera. */
  private apply(): void {
    const a = this.available();
    const rw = this.world.width * this.zoom;
    const rh = this.world.height * this.zoom;
    this.offsetX = Math.round(clampAxis(this.offsetX, rw, a.left, a.width));
    this.offsetY = Math.round(clampAxis(this.offsetY, rh, a.top, a.height));
    this.cam.setZoom(this.zoom);
    this.cam.setScroll(-this.offsetX / this.zoom, -this.offsetY / this.zoom);
  }

  /** Changes zoom keeping the world point under (fx, fy) fixed on screen. */
  private zoomAt(newZoom: number, fx: number, fy: number): void {
    const z = clampZoom(newZoom);
    const wx = (fx - this.offsetX) / this.zoom;
    const wy = (fy - this.offsetY) / this.zoom;
    this.zoom = z;
    this.offsetX = fx - wx * z;
    this.offsetY = fy - wy * z;
    this.apply();
  }

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, this.local(e));
    if (this.pointers.size === 1) {
      const p = this.local(e);
      this.dragging = false;
      this.dragStart = { x: p.x, y: p.y, offsetX: this.offsetX, offsetY: this.offsetY };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.pinch = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: this.zoom,
        wx: (mx - this.offsetX) / this.zoom,
        wy: (my - this.offsetY) / this.zoom,
      };
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, this.local(e));
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.dist;
      this.zoom = clampZoom(Math.round(this.pinch.zoom * ratio));
      this.offsetX = mx - this.pinch.wx * this.zoom;
      this.offsetY = my - this.pinch.wy * this.zoom;
      this.apply();
      return;
    }
    if (this.pointers.size === 1) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (!this.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.offsetX = this.dragStart.offsetX + dx;
      this.offsetY = this.dragStart.offsetY + dy;
      this.apply();
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    // Continue panning with the remaining finger from where it is now.
    const rest = [...this.pointers.values()][0];
    if (rest) {
      this.dragging = true;
      this.dragStart = { x: rest.x, y: rest.y, offsetX: this.offsetX, offsetY: this.offsetY };
    }
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelAccum += e.deltaY;
    if (Math.abs(this.wheelAccum) < WHEEL_STEP) return;
    const dir = this.wheelAccum < 0 ? 1 : -1;
    this.wheelAccum = 0;
    const p = this.local(e);
    this.zoomAt(this.zoom + dir, p.x, p.y);
  };
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z)));
}

/** Keeps a room of `size` inside the available span; centres it when smaller. */
function clampAxis(offset: number, size: number, start: number, span: number): number {
  if (size <= span) return start + (span - size) / 2;
  return Math.min(start, Math.max(start + span - size, offset));
}
