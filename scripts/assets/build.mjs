// npm run assets:build — packs assets/sprites/**/*.px into public/assets/ (atlas.png, atlas.json, anims.json).
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildAll, OUT_DIR } from './lib.mjs';

try {
  const files = buildAll();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, data] of Object.entries(files)) writeFileSync(`${OUT_DIR}/${name}`, data);
  console.log(`assets:build wrote ${Object.keys(files).join(', ')} to public/assets/`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
