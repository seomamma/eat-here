// Authoring helpers for the sprite maps (assets/sprites/**/*.px). The .px files are the source of
// truth; these scripts are the tools that drafted them. Re-running a generator overwrites hand edits,
// so after the first draft edit the .px files directly.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SPRITES = new URL('../sprites/', import.meta.url).pathname;

/** Grid of palette chars ('.' = transparent). */
export class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = Array.from({ length: h }, () => Array(w).fill('.'));
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.c[y][x];
  }
  set(x, y, ch) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch;
  }
  rect(x0, y0, x1, y1, ch) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
  }
  /** Stamps text rows at (x, y); '.' and ' ' are transparent. `map` recolours chars. */
  put(x, y, rows, map = {}) {
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === '.' || ch === ' ') return;
        this.set(x + rx, y + ry, map[ch] ?? ch);
      }),
    );
  }
  /** 1 px outline outside every opaque pixel (4-neighbourhood). */
  outline(ch = 'k') {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.c[y][x] !== '.') continue;
        if (
          this.get(x - 1, y) !== '.' ||
          this.get(x + 1, y) !== '.' ||
          this.get(x, y - 1) !== '.' ||
          this.get(x, y + 1) !== '.'
        )
          add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, ch);
  }
  rows() {
    return this.c.map((r) => r.join(''));
  }
}

/** Writes a .px file below assets/sprites/. */
export function writePx(rel, text) {
  const p = join(SPRITES, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

/** Builds the text of one sprite: anims = [{name, dir, fps, loop, frames: string[][]}]. */
export function spriteText(header, anims, extra = '') {
  const out = [header];
  for (const a of anims) {
    out.push('', `anim ${a.name} ${a.dir} fps ${a.fps}${a.loop === false ? ' once' : ''}`);
    for (const f of a.frames) out.push('frame', ...f, '');
  }
  if (extra) out.push(extra);
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
