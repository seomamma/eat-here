import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The pipeline is plain Node (scripts/assets/*.mjs, no types); tests drive it through its CLI.
const run = (script: string) =>
  execFileSync('node', [script], { cwd: process.cwd(), encoding: 'utf8' });

describe('sprite assets (D-040)', () => {
  it('passes assets:check (palette-only colours, sizes, feet row, names)', () => {
    expect(run('scripts/assets/check.mjs')).toContain('assets:check OK');
  });

  it('committed atlas files are up to date with assets/sprites', () => {
    const script = `
      import { buildAll, OUT_DIR } from './scripts/assets/lib.mjs';
      import { readFileSync } from 'node:fs';
      const files = buildAll();
      const stale = Object.entries(files).filter(([n, d]) => !readFileSync(OUT_DIR + '/' + n).equals(Buffer.from(d)));
      console.log(JSON.stringify(stale.map(([n]) => n)));
    `;
    const out = execFileSync('node', ['--input-type=module', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(JSON.parse(out.trim())).toEqual([]);
  });

  it('every frame in anims.json exists in atlas.json', () => {
    const atlas = JSON.parse(readFileSync('public/assets/atlas.json', 'utf8')) as {
      frames: Record<string, unknown>;
    };
    const anims = JSON.parse(readFileSync('public/assets/anims.json', 'utf8')) as {
      entities: Record<string, { anims: Record<string, { frames: string[] }> }>;
    };
    for (const e of Object.values(anims.entities))
      for (const a of Object.values(e.anims))
        for (const f of a.frames) expect(atlas.frames[f]).toBeDefined();
  });
});
