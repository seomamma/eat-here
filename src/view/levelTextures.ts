import Phaser from 'phaser';
import { C, Raster, upload } from './placeholderTextures';

/**
 * Visual change by furniture level (M12), cheap placeholder version of the final art variants:
 * Lv.1-2 plain, Lv.3-4 a gold trim along the lower edge of the sprite, Lv.5 a thicker trim and a
 * small blinking sparkle. Variants are made on demand from the base texture, so every piece
 * (including the oven's glow frames) gets them without extra drawing code.
 */
export type LevelTier = 0 | 1 | 2;

export const TIER_GOLD_FROM_LEVEL = 3;
export const TIER_SPARKLE_FROM_LEVEL = 5;
/** Sparkle positions alternate between these two frames. */
export const SPARKLE_FRAME_COUNT = 2;

export function levelTier(level: number): LevelTier {
  if (level >= TIER_SPARKLE_FROM_LEVEL) return 2;
  return level >= TIER_GOLD_FROM_LEVEL ? 1 : 0;
}

/** Key of the texture a piece of this level uses (made if missing). `frame` only matters at Lv.5. */
export function levelTextureKey(
  textures: Phaser.Textures.TextureManager,
  baseKey: string,
  level: number,
  frame = 0,
): string {
  const tier = levelTier(level);
  if (tier === 0) return baseKey;
  const key = tier === 1 ? `${baseKey}@gold` : `${baseKey}@star${frame % SPARKLE_FRAME_COUNT}`;
  if (!textures.exists(key))
    upload(textures, key, withTrim(readRaster(textures, baseKey), tier, frame));
  return key;
}

function readRaster(textures: Phaser.Textures.TextureManager, key: string): Raster {
  const src = textures.get(key).getSourceImage() as HTMLCanvasElement;
  const ctx = src.getContext('2d');
  if (!ctx) throw new Error(`no 2d context for ${key}`);
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  const r = new Raster(width, height);
  for (let i = 0; i < width * height; i++) {
    if ((data[i * 4 + 3] ?? 0) === 0) continue;
    const hex = [0, 1, 2].map((k) => (data[i * 4 + k] ?? 0).toString(16).padStart(2, '0')).join('');
    r.px[i] = `#${hex.toUpperCase()}`;
  }
  return r;
}

/** Colours of the trim: the outline stays dark, the pixel(s) above it turn gold. */
export function withTrim(base: Raster, tier: 1 | 2, frame: number): Raster {
  const r = new Raster(base.w, base.h);
  r.px.splice(0, r.px.length, ...base.px);
  const outline = C.outline.toUpperCase();
  for (let x = 0; x < base.w; x++) {
    let bottom = -1;
    for (let y = base.h - 1; y >= 0; y--) {
      if (base.get(x, y)) {
        bottom = y;
        break;
      }
    }
    if (bottom < 2) continue;
    const rows = tier === 2 ? 2 : 1;
    for (let k = 1; k <= rows; k++) {
      const c = base.get(x, bottom - k);
      if (c && c.toUpperCase() !== outline) r.set(x, bottom - k, k === 1 ? C.cheese2 : C.cheese3);
    }
  }
  if (tier === 2) addSparkle(base, r, frame);
  return r;
}

/** A tiny plus of bright pixels near the top of the silhouette (only on existing pixels). */
function addSparkle(base: Raster, out: Raster, frame: number): void {
  const dx = frame % SPARKLE_FRAME_COUNT === 0 ? -3 : 3;
  const cx = Math.round(base.w / 2) + dx;
  let top = -1;
  for (let y = 0; y < base.h && top < 0; y++) if (base.get(cx, y)) top = y;
  if (top < 0) return;
  const cy = top + 3 + (frame % SPARKLE_FRAME_COUNT);
  const spots: [number, number, string][] = [
    [cx, cy, C.cream1],
    [cx - 1, cy, C.cheese3],
    [cx + 1, cy, C.cheese3],
    [cx, cy - 1, C.cheese3],
    [cx, cy + 1, C.cheese3],
  ];
  for (const [x, y, c] of spots) if (base.get(x, y)) out.set(x, y, c);
}
