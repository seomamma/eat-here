import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

async function lint(code: string, filePath = 'src/sim/__probe__.ts') {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

describe('sim lint boundary', () => {
  it('rejects importing phaser', async () => {
    const msgs = await lint("import Phaser from 'phaser';\nexport const x = Phaser;\n");
    expect(msgs.some((m) => m.ruleId === 'no-restricted-imports' && m.severity === 2)).toBe(true);
  });

  it('rejects importing preact', async () => {
    const msgs = await lint("import { h } from 'preact';\nexport const x = h;\n");
    expect(msgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('rejects importing view/ui code', async () => {
    const a = await lint("import { x } from '../view/foo';\nexport const y = x;\n");
    const b = await lint("import { x } from '../ui/App';\nexport const y = x;\n");
    expect(a.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
    expect(b.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('rejects DOM globals', async () => {
    const msgs = await lint(
      'export const w = window.innerWidth;\nexport const s = localStorage;\n',
    );
    expect(msgs.filter((m) => m.ruleId === 'no-restricted-globals').length).toBe(2);
  });

  it('allows pure code in sim', async () => {
    expect(await lint('export const x = 1;\n')).toEqual([]);
  });

  it('does not restrict phaser outside sim', async () => {
    const msgs = await lint(
      "import Phaser from 'phaser';\nexport const x = Phaser;\n",
      'src/view/__probe__.ts',
    );
    expect(msgs.filter((m) => m.ruleId === 'no-restricted-imports')).toEqual([]);
  });
});
