// Draft generator for the M13b art (furniture, level overlays, props, fx). The .px files in
// assets/sprites/ are the source of truth; running this overwrites them (hand edits are lost),
// so it is only a drafting aid. After the first draft edit the .px files directly.
import { spriteText, writePx } from './lib.mjs';
import { ovenText } from './m13b-oven.mjs';
import { dogText } from './m13b-dog.mjs';
import { outdoorText } from './m13b-outdoor.mjs';
import { fxText } from './m13b-fx.mjs';
import { emitPiece } from './m13b-lib.mjs';
import { DECOR } from './m13b-decor.mjs';
import { FUN } from './m13b-fun.mjs';
import { SEATING } from './m13b-seating.mjs';

const only = process.argv.slice(2);
const want = (n) => only.length === 0 || only.includes(n);
if (want('decor')) writePx('world/furniture_decor.px', DECOR.map(emitPiece).join('\n'));
if (want('fun')) writePx('world/furniture_fun.px', FUN.map(emitPiece).join('\n'));
if (want('seating')) writePx('world/furniture_seating.px', SEATING.map(emitPiece).join('\n'));
if (want('oven')) {
  const woodpile = [
    '..........',
    '..........',
    '..kkkkkk..',
    '.kdcbbbbk.',
    '.kdcbbbbk.',
    'kkkkkkkkkk',
    'kdcbbkdcbk',
    'kdcbbkdcbk',
    'kkkkkkkkkk',
  ];
  const wp = spriteText('sprite oven_woodpile 10x9 pivot 5,8 kind prop', [
    { name: 'still', dir: 'none', fps: 1, frames: [woodpile] },
  ]);
  writePx('world/oven.px', ovenText(spriteText) + '\n' + wp);
}
if (want('dog')) writePx('characters/dog.px', dogText(spriteText));
if (want('outdoor')) {
  const o = outdoorText();
  writePx('world/ground.px', o.ground);
  writePx('world/props.px', o.props);
}
if (want('fx')) writePx('ui/fx.px', fxText());
