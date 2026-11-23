// Framework for the M13b furniture drafts: every piece is drawn by a function (view, tier, frame)
// and emitted as the sprite itself plus two overlay sprites made from the differences:
//   trim_<id>   Lv.3+ (tier 1) pixels that differ from the base, same canvas and pivot
//   accent_<id> Lv.5 (tier 2) pixels that differ from tier 1, two frames (blink)
import { Grid, diff } from './iso.mjs';
import { spriteText } from './lib.mjs';

/** Sprite size of a boxes() canvas. */
export const canvas = (w, h, oy) => ({ W: (w + h) * 16, H: oy + (w + h) * 8 });

/** A 5-pixel sparkle at (x, y): frame 0 = plus, frame 1 = single bright pixel. `on` swaps the roles. */
export function glint(g, x, y, on) {
  if (on) {
    g.set(x, y, 'W');
    g.set(x - 1, y, 'v');
    g.set(x + 1, y, 'v');
    g.set(x, y - 1, 'v');
    g.set(x, y + 1, 'v');
  } else {
    g.set(x, y, 'v');
  }
}

/**
 * piece: { id, w, h, origin: [ox, oy], draw(view, tier, frame) -> Grid, extra?: anims, trims?: boolean }
 * Returns the .px text of the base sprite and of its two overlays.
 */
export function emitPiece(piece) {
  const { id, w, h, origin } = piece;
  const [ox, oy] = origin;
  const { W, H } = canvas(w, h, oy);
  const header = (name) => `sprite ${name} ${W}x${H} pivot ${ox},${oy} kind prop`;
  const A = (name, dir, frames, fps = 1) => ({ name, dir, fps, frames: frames.map((g) => g.rows()) });
  const base = {
    front: piece.draw('front', 0, 0),
    back: piece.draw('back', 0, 0),
  };
  const anims = [A('still', 'front', [base.front]), A('still', 'back', [base.back])];
  for (const ex of piece.extra ?? []) anims.push(A(ex.name, ex.dir, ex.frames, ex.fps));
  const text = [spriteText(header(id), anims)];
  if (piece.trims !== false) {
    const trim = (view) => diff(base[view], piece.draw(view, 1, 0));
    text.push(spriteText(header(`trim_${id}`), [A('still', 'front', [trim('front')]), A('still', 'back', [trim('back')])]));
    const acc = (view, f) => diff(piece.draw(view, 1, 0), piece.draw(view, 2, f));
    text.push(
      spriteText(header(`accent_${id}`), [
        A('blink', 'front', [acc('front', 0), acc('front', 1)], 1.6),
        A('blink', 'back', [acc('back', 0), acc('back', 1)], 1.6),
      ]),
    );
  }
  return text.join('\n');
}

export { Grid };
