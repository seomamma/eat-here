import Phaser from 'phaser';
import { RECIPE_IDS } from '../data/recipes';
import { DISH_TEX, ORDER_BUBBLE_TEX } from './placeholderTextures';

/**
 * Hand-authored sprite atlas (D-040). Built by `npm run assets:build` from assets/sprites/**.px.
 * Static frames are copied into canvas textures under the keys the placeholder art used, so
 * everything not drawn yet keeps working; characters play animations straight from the atlas.
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

/** Maps atlas frames onto the texture keys of the placeholder art (before it is generated). */
export function installArtAliases(textures: Phaser.Textures.TextureManager): void {
  if (!textures.exists(ART_ATLAS)) return;
  const names = textures.get(ART_ATLAS).getFrameNames();
  for (const name of names) {
    let key: string | null = null;
    const still = /^(.*)_still_(none|front|back)_0$/.exec(name);
    if (still) key = still[2] === 'back' ? `${still[1]}_back` : (still[1] ?? null);
    const bake = /^oven_pizza_bake_front_(\d)$/.exec(name);
    if (bake) key = `oven_pizza_bake_${bake[1]}`;
    if (name === 'coin_spin_none_0') key = 'coin';
    if (!key || key === 'shadow' || key === 'bubble_order') continue;
    const fr = textures.getFrame(ART_ATLAS, name);
    copyFrame(textures, key, [{ name, dx: 0, dy: 0 }], fr.cutWidth, fr.cutHeight);
  }
  // Order bubbles: the empty frame with the dish icon inside.
  const bubble = 'bubble_order_still_none_0';
  if (!names.includes(bubble)) return;
  for (const id of RECIPE_IDS) {
    const dish = `${DISH_TEX[id]}_still_none_0`;
    if (!names.includes(dish)) continue;
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
}
