import { signal } from '@preact/signals';
import type { FurnitureDefId } from '../data/furniture';
import type { FloorStyleId, WallStyleId } from '../data/surfaces';

/**
 * Shop and paint-bar icons cut from the real atlas art (M13b): the front view of a piece trimmed
 * to its pixels and scaled by a whole factor, floor and wall swatches cropped from the style's
 * tile. Made once per image as a data URL; the atlas is loaded on first use (outside Phaser, the
 * browser cache serves the same files the game loads). Until then the functions return '' and
 * `iconsReady` flips to true when they can be asked again.
 */
export const iconsReady = signal(false);

interface AtlasData {
  image: HTMLImageElement;
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
}
let atlas: AtlasData | null = null;
let loading = false;
const cache = new Map<string, string>();

/** Largest icon size in art pixels (the shop box has 52 CSS px inside its frame). */
const ICON_MAX_PX = 52;

function load(): void {
  if (loading) return;
  loading = true;
  const image = new Image();
  const frames = fetch('assets/atlas.json')
    .then((r) => r.json() as Promise<{ frames: AtlasData['frames'] }>)
    .then((j) => j.frames);
  const decoded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('atlas image failed to load'));
    image.src = 'assets/atlas.png';
  });
  Promise.all([frames, decoded])
    .then(([f]) => {
      atlas = { image, frames: f };
      iconsReady.value = true;
    })
    .catch(() => {
      loading = false; // try again on the next request
    });
}

/** Crops a rectangle of an atlas frame, optionally trims transparent borders, scales by `k`. */
function crop(
  frameName: string,
  opts: { rect?: [number, number, number, number]; trim?: boolean; scale?: number | 'fit' },
): string {
  const key = `${frameName}|${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!atlas) {
    load();
    return '';
  }
  const f = atlas.frames[frameName]?.frame;
  if (!f) return '';
  const [rx, ry, rw, rh] = opts.rect ?? [0, 0, f.w, f.h];
  const src = document.createElement('canvas');
  src.width = rw;
  src.height = rh;
  const sctx = src.getContext('2d');
  if (!sctx) return '';
  sctx.drawImage(atlas.image, f.x + rx, f.y + ry, rw, rh, 0, 0, rw, rh);
  let [x0, y0, x1, y1] = [0, 0, rw, rh];
  if (opts.trim) {
    const data = sctx.getImageData(0, 0, rw, rh).data;
    x0 = rw;
    y0 = rh;
    x1 = 0;
    y1 = 0;
    for (let y = 0; y < rh; y++)
      for (let x = 0; x < rw; x++) {
        if ((data[(y * rw + x) * 4 + 3] ?? 0) === 0) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
    if (x1 <= x0) return '';
  }
  const w = x1 - x0;
  const h = y1 - y0;
  const k =
    opts.scale === 'fit'
      ? Math.max(1, Math.floor(ICON_MAX_PX / Math.max(w, h)))
      : (opts.scale ?? 1);
  const out = document.createElement('canvas');
  out.width = w * k;
  out.height = h * k;
  const octx = out.getContext('2d');
  if (!octx) return '';
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, x0, y0, w, h, 0, 0, w * k, h * k);
  const url = out.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** Data URL of a piece's front view (Lv.1), trimmed and scaled to fit the shop box; '' until ready. */
export function furnitureIconUrl(defId: FurnitureDefId): string {
  return crop(`${defId}_still_front_0`, { trim: true, scale: 'fit' });
}

/** Floor swatch: a patch cut from the middle of the style's tile (36 x 18 px). */
export function floorSwatchUrl(style: FloorStyleId): string {
  const frame: Record<FloorStyleId, string> = {
    wood: 'floor_wood_0',
    checker: 'floor_tile',
    terracotta: 'floor_terracotta',
    herringbone: 'floor_herringbone',
  };
  return crop(`${frame[style]}_still_none_0`, { rect: [10, 5, 12, 6], scale: 3 });
}

/** Wall swatch: a patch cut from the face of the style's left back wall (36 x 24 px). */
export function wallSwatchUrl(style: WallStyleId): string {
  const name = style === 'cream' ? 'wall_back_l' : `wall_back_l_${style}`;
  return crop(`${name}_still_none_0`, { rect: [0, 24, 12, 8], scale: 3 });
}
