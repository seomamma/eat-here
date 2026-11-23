import Phaser from 'phaser';
import { FURNITURE, type FurnitureDefId } from '../data/furniture';
import { RECIPE_IDS } from '../data/recipes';
import { DISH_TEX, ORDER_BUBBLE_TEX, requiredTextureKeys } from './textureKeys';

/**
 * Hand-authored sprite atlas (D-040). Built by `npm run assets:build` from assets/sprites/**.px.
 * Static frames are copied into canvas textures under stable keys (`installArtAliases`), so the
 * renderers address a sprite by name; characters and kids play animations straight from the atlas.
 */
export const ART_ATLAS = 'art';
export const ART_ANIMS = 'art-anims';

export interface ArtAnim {
  fps: number;
  loop: boolean;
  frames: string[];
}
export interface ArtEntity {
  kind: string;
  w: number;
  h: number;
  pivot: [number, number];
  /** Keyed `<anim>_<dir>` (dir = front | back | none). */
  anims: Record<string, ArtAnim>;
}

export function preloadArt(scene: Phaser.Scene): void {
  scene.load.atlas(ART_ATLAS, 'assets/atlas.png', 'assets/atlas.json');
  scene.load.json(ART_ANIMS, 'assets/anims.json');
}

export function artEntities(scene: Phaser.Scene): Record<string, ArtEntity> {
  const data = scene.cache.json.get(ART_ANIMS) as
    { entities: Record<string, ArtEntity> } | undefined;
  return data?.entities ?? {};
}

function copyFrame(
  textures: Phaser.Textures.TextureManager,
  key: string,
  frames: { name: string; dx: number; dy: number }[],
  w: number,
  h: number,
): void {
  if (textures.exists(key)) return;
  const canvas = textures.createCanvas(key, w, h);
  if (!canvas) return;
  const ctx = canvas.getContext();
  for (const f of frames) {
    const fr = textures.getFrame(ART_ATLAS, f.name);
    ctx.drawImage(
      fr.source.image as CanvasImageSource,
      fr.cutX,
      fr.cutY,
      fr.cutWidth,
      fr.cutHeight,
      f.dx,
      f.dy,
      fr.cutWidth,
      fr.cutHeight,
    );
  }
  canvas.refresh();
}

/** Entities that are animated sprites (drawn from the atlas directly, not copied). */
const WALKERS = new Set(['character', 'kid', 'critter']);
/** Not copied: the shadow is an atlas image, the bare order bubble is composited below. */
const SKIPPED = new Set(['shadow', 'bubble_order']);

/**
 * Texture key of one frame of a static (non-walker) entity: `still` frames use the entity name
 * (`<name>_back` for the back view), other animations `<name>_<anim>[_back]_<n>`.
 */
export function aliasKey(entity: string, anim: string, dir: string, n: number): string {
  const back = dir === 'back' ? '_back' : '';
  return anim === 'still' ? `${entity}${back}` : `${entity}_${anim}${back}_${n}`;
}

/** Copies the atlas frames of every static entity onto their texture keys (see `aliasKey`). */
export function installArtAliases(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures.exists(ART_ATLAS)) return;
  const names = textures.get(ART_ATLAS).getFrameNames();
  for (const [entity, e] of Object.entries(artEntities(scene))) {
    if (WALKERS.has(e.kind) || SKIPPED.has(entity)) continue;
    for (const [animKey, anim] of Object.entries(e.anims)) {
      const m = /^(.*)_(front|back|none)$/.exec(animKey);
      if (!m) continue;
      anim.frames.forEach((name, n) => {
        copyFrame(
          textures,
          aliasKey(entity, m[1] as string, m[2] as string, n),
          [{ name, dx: 0, dy: 0 }],
          e.w,
          e.h,
        );
      });
    }
  }
  // Order bubbles: the empty frame with the dish icon inside.
  const bubble = 'bubble_order_still_none_0';
  for (const id of RECIPE_IDS) {
    const dish = `${DISH_TEX[id]}_still_none_0`;
    if (!names.includes(bubble) || !names.includes(dish)) continue;
    copyFrame(
      textures,
      ORDER_BUBBLE_TEX[id],
      [
        { name: bubble, dx: 0, dy: 0 },
        { name: dish, dx: 3, dy: 2 },
      ],
      18,
      19,
    );
  }
  ensureArtKeys(textures, Object.keys(FURNITURE) as FurnitureDefId[]);
}

/**
 * Minimal fallback for a frame missing from the atlas: a magenta box, plus a warning in dev so a
 * forgotten `npm run assets:build` or a misspelt key is noticed at once.
 */
function ensureArtKeys(
  textures: Phaser.Textures.TextureManager,
  furniture: readonly FurnitureDefId[],
): void {
  for (const key of requiredTextureKeys(furniture)) {
    if (textures.exists(key)) continue;
    if (import.meta.env.DEV) console.warn(`[art] missing texture "${key}", using a fallback box`);
    const tex = textures.createCanvas(key, 16, 16);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#2b1d16';
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(3, 3, 10, 10);
    tex.refresh();
  }
}
