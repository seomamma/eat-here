import Phaser from 'phaser';
import type { Bounds, Point } from './iso';

/**
 * HUD space (CSS px) reserved at the top/bottom of the screen; the room is fitted into what
 * remains. Landscape is slimmer so the room is not tiny (D-026). The single place to tune these.
 */
export const HUD_INSETS_PORTRAIT = { top: 152, bottom: 88 } as const;
export const HUD_INSETS_LANDSCAPE = { top: 70, bottom: 68 } as const;
/**
 * Portrait only: if the fit-whole-room zoom leaves the room narrower than this fraction of the
 * available width, start one integer zoom step closer (the player pans around the room).
 */
export const PORTRAIT_MIN_FILL = 0.8;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Wheel delta (px) that amounts to one zoom step. */
const WHEEL_STEP = 60;
/** Pointer travel (CSS px) before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Insets in CSS px for the given viewport size. */
export function hudInsets(cssWidth: number, cssHeight: number): { top: number; bottom: number } {
  return cssWidth > cssHeight ? HUD_INSETS_LANDSCAPE : HUD_INSETS_PORTRAIT;
}

/** Lets the build mode claim a one-finger drag (e.g. on the ghost) before it pans the camera. */
export interface ObjectDrag {
  /** Pointer went down at this world position: return true to take over the gesture. */
  begin(world: Point): boolean;
  move(world: Point): void;
  end(): void;
}

/**
 * Pan (drag), zoom (pinch / wheel) with integer zoom only, clamped to the room.
 *
 * All camera maths is in canvas pixels, which are device pixels (see deviceCanvas.ts), so a
 * zoom of `z` means every art pixel is exactly `z x z` physical pixels. A world point maps to
 * the canvas as `world * zoom + offset`, with `offset` kept integer. CSS-pixel inputs (HUD
 * insets, drag threshold, pointer positions) are converted with the canvas' pixel ratio.
 */
export class CameraController {
  private zoom = MIN_ZOOM;
  private offsetX = 0;
  private offsetY = 0;
  private readonly pointers = new Map<number, Point>();
  private dragging = false;
  /** True once the current gesture dragged or pinched, so its release is not a tap. */
  private gestureMoved = false;
  private dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  private pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;
  private wheelAccum = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private tapHandler: ((world: Point) => void) | null = null;
  private objectDrag: ObjectDrag | null = null;
  private draggingObject = false;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World-space rectangle that must stay reachable (the visible room). */
    private readonly bounds: Bounds,
  ) {
    this.cam = scene.cameras.main;
    this.cam.setOrigin(0, 0);
    this.canvas = scene.game.canvas;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onCancel);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.fit();
  }

  get currentZoom(): number {
    return this.zoom;
  }

  /** Called with the world position of a tap (press and release without dragging). */
  onTap(handler: (world: Point) => void): void {
    this.tapHandler = handler;
  }

  /** Installs (or clears) the object-drag hook; null = every one-finger drag pans. */
  setObjectDrag(handler: ObjectDrag | null): void {
    this.objectDrag?.end();
    this.draggingObject = false;
    this.objectDrag = handler;
  }

  private toWorld(p: Point): Point {
    return { x: (p.x - this.offsetX) / this.zoom, y: (p.y - this.offsetY) / this.zoom };
  }

  /** Re-fits the room into the available area (also on resize / rotation). */
  fit(): void {
    const a = this.available();
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    this.zoom = clampZoom(Math.floor(Math.min(a.width / bw, a.height / bh)));
    const portrait = this.scene.scale.height > this.scene.scale.width;
    if (portrait && bw * this.zoom < PORTRAIT_MIN_FILL * a.width)
      this.zoom = clampZoom(this.zoom + 1);
    // Centre the room in the available area.
    this.offsetX = a.left + (a.width - bw * this.zoom) / 2 - this.bounds.minX * this.zoom;
    this.offsetY = a.top + (a.height - bh * this.zoom) / 2 - this.bounds.minY * this.zoom;
    this.apply();
  }

  private destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this);
  }

  /** Canvas pixels per CSS pixel (the device pixel ratio the canvas was sized with). */
  private pixelRatio(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.width > 0 ? this.canvas.width / r.width : 1;
  }

  /** Canvas-pixel rectangle left for the room after the HUD insets. */
  private available() {
    const { width, height } = this.scene.scale;
    const ratio = this.pixelRatio();
    const insets = hudInsets(width / ratio, height / ratio);
    const top = Math.round(insets.top * ratio);
    const bottom = Math.round(insets.bottom * ratio);
    return { left: 0, top, width: Math.max(1, width), height: Math.max(1, height - top - bottom) };
  }

  /** Clamps the offset to the room bounds, rounds to whole pixels and updates the camera. */
  private apply(): void {
    const a = this.available();
    const { minX, maxX, minY, maxY } = this.bounds;
    this.offsetX = Math.round(
      clampAxis(this.offsetX, minX * this.zoom, maxX * this.zoom, a.left, a.width),
    );
    this.offsetY = Math.round(
      clampAxis(this.offsetY, minY * this.zoom, maxY * this.zoom, a.top, a.height),
    );
    this.applyCamera();
  }

  /**
   * `screen = (world - scroll) * zoom + viewport origin`. Scroll must be an exact integer:
   * `offset / zoom` is a float, and its rounding noise makes some sprites land one device pixel
   * off. So the offset is split into an integer scroll plus a viewport origin in [0, zoom).
   */
  private applyCamera(): void {
    const { width, height } = this.scene.scale;
    const sx = -Math.floor(this.offsetX / this.zoom);
    const sy = -Math.floor(this.offsetY / this.zoom);
    const rx = this.offsetX + sx * this.zoom;
    const ry = this.offsetY + sy * this.zoom;
    this.cam.setViewport(rx, ry, width - rx, height - ry);
    this.cam.setZoom(this.zoom);
    this.cam.setScroll(sx, sy);
  }

  /** Changes zoom keeping the world point under canvas position (fx, fy) fixed. */
  private zoomAt(newZoom: number, fx: number, fy: number): void {
    const z = clampZoom(newZoom);
    const wx = (fx - this.offsetX) / this.zoom;
    const wy = (fy - this.offsetY) / this.zoom;
    this.zoom = z;
    this.offsetX = fx - wx * z;
    this.offsetY = fy - wy * z;
    this.apply();
  }

  /** Pointer position in canvas (device) pixels. */
  private local(e: PointerEvent | WheelEvent): Point {
    const r = this.canvas.getBoundingClientRect();
    const k = r.width > 0 ? this.canvas.width / r.width : 1;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  }

  private readonly onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, this.local(e));
    if (this.pointers.size === 1) {
      const p = this.local(e);
      this.dragging = false;
      this.gestureMoved = false;
      this.dragStart = { x: p.x, y: p.y, offsetX: this.offsetX, offsetY: this.offsetY };
      if (this.objectDrag?.begin(this.toWorld(p))) {
        this.draggingObject = true;
        this.gestureMoved = true;
      }
    } else if (this.pointers.size === 2) {
      this.endObjectDrag();
      this.gestureMoved = true;
      const [a, b] = [...this.pointers.values()] as [Point, Point];
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
    if (this.draggingObject) {
      this.objectDrag?.move(this.toWorld(this.local(e)));
      return;
    }
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()] as [Point, Point];
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
      if (!this.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD * this.pixelRatio()) return;
      this.dragging = true;
      this.gestureMoved = true;
      this.offsetX = this.dragStart.offsetX + dx;
      this.offsetY = this.dragStart.offsetY + dy;
      this.apply();
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    const wasOnly = this.pointers.size === 1 && this.pointers.has(e.pointerId);
    this.endObjectDrag();
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (wasOnly && !this.gestureMoved && this.tapHandler) {
      const p = this.local(e);
      this.tapHandler({ x: (p.x - this.offsetX) / this.zoom, y: (p.y - this.offsetY) / this.zoom });
    }
    // Continue panning with the remaining finger from where it is now.
    const rest = [...this.pointers.values()][0];
    if (rest) {
      this.dragging = true;
      this.dragStart = { x: rest.x, y: rest.y, offsetX: this.offsetX, offsetY: this.offsetY };
    }
  };

  private endObjectDrag(): void {
    if (!this.draggingObject) return;
    this.draggingObject = false;
    this.objectDrag?.end();
  }

  private readonly onCancel = (e: PointerEvent): void => {
    this.gestureMoved = true; // a cancelled gesture is never a tap
    this.onUp(e);
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

/**
 * Keeps the room span [lo, hi] (world * zoom, before the offset) inside the available span
 * [start, start + span]; centres it when it is smaller.
 */
function clampAxis(offset: number, lo: number, hi: number, start: number, span: number): number {
  const size = hi - lo;
  if (size <= span) return start + (span - size) / 2 - lo;
  // Room edges may not move inside the available area: lo + offset <= start, hi + offset >= start + span.
  return Math.min(start - lo, Math.max(start + span - hi, offset));
}
