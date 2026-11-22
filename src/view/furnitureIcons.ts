import type { FurnitureDefId } from '../data/furniture';
import { furnitureRaster } from './placeholderTextures';

const cache = new Map<FurnitureDefId, string>();

/** Data URL of the placeholder sprite (front view) for shop icons; made once per piece. */
export function furnitureIconUrl(defId: FurnitureDefId): string {
  const hit = cache.get(defId);
  if (hit) return hit;
  const r = furnitureRaster(defId);
  const canvas = document.createElement('canvas');
  canvas.width = r.w;
  canvas.height = r.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(r.w, r.h);
  r.px.forEach((c, i) => {
    if (!c) return;
    const n = parseInt(c.slice(1), 16);
    img.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  cache.set(defId, url);
  return url;
}
