import {
  FLOOR_STYLES,
  FLOOR_STYLE_IDS,
  WALL_STYLES,
  WALL_STYLE_IDS,
  type SurfaceStyle,
} from '../../data/surfaces';
import { STRINGS } from '../../data/strings';
import { exitBuild, paintStyle, paintStroke, setPaintStyle, type PaintTarget } from '../build';
import { getSim, money, rank } from '../store';
import { floorSwatchUrl, iconsReady, wallSwatchUrl } from '../../view/furnitureIcons';
import {
  validatePaintFloor,
  validatePaintWall,
  type PaintResult,
} from '../../sim/systems/surfaces';

const P = STRINGS.build.paint;

/** CSS background-image of a style chip: the real tile art once the atlas is loaded. */
function swatchImage(t: PaintTarget): string | undefined {
  const url = t.kind === 'floor' ? floorSwatchUrl(t.id) : wallSwatchUrl(t.id);
  return url ? `url(${url})` : undefined;
}

function styleOf(t: PaintTarget): SurfaceStyle {
  return t.kind === 'floor' ? FLOOR_STYLES[t.id] : WALL_STYLES[t.id];
}

/** Cost and validity of the stroke in progress (a pure query on the sim state). */
function strokeResult(): PaintResult | null {
  const sim = getSim();
  const style = paintStyle.value;
  const stroke = paintStroke.value;
  if (!sim || !style || !stroke) return null;
  return style.kind === 'floor'
    ? validatePaintFloor(sim.state, stroke.tiles, style.id)
    : validatePaintWall(sim.state, stroke.segments, style.id);
}

/** Paint mode controls: Floors / Walls tabs, style chips with price and rank, hint, Done. */
export function PaintBar() {
  const style = paintStyle.value;
  if (!style) return null;
  void money.value;
  void iconsReady.value; // re-render once the atlas swatches can be made
  const ids: readonly (PaintTarget & { kind: typeof style.kind })[] =
    style.kind === 'floor'
      ? FLOOR_STYLE_IDS.map((id) => ({ kind: 'floor' as const, id }))
      : WALL_STYLE_IDS.map((id) => ({ kind: 'wall' as const, id }));
  const res = strokeResult();
  const hint = res
    ? res.ok
      ? P.cost(res.changed, res.cost)
      : (P.reasons[res.reason] ?? res.reason)
    : style.kind === 'floor'
      ? P.hint
      : P.hintWall;
  return (
    <div class="paint-bar interactive" role="dialog" aria-label={P.title}>
      <div class="tabs paint-tabs" role="tablist">
        {(['floor', 'wall'] as const).map((k) => (
          <button
            type="button"
            role="tab"
            key={k}
            aria-selected={style.kind === k}
            class={`tab${style.kind === k ? ' tab--on' : ''}`}
            onClick={() =>
              setPaintStyle(
                k === 'floor' ? { kind: 'floor', id: 'wood' } : { kind: 'wall', id: 'cream' },
              )
            }
          >
            {k === 'floor' ? P.floors : P.walls}
          </button>
        ))}
      </div>
      <div class="paint-chips">
        {ids.map((t) => {
          const def = styleOf(t);
          const locked = rank.value < def.rank;
          const on = style.id === t.id;
          return (
            <button
              type="button"
              key={t.id}
              disabled={locked}
              aria-pressed={on}
              class={`paint-chip${on ? ' paint-chip--on' : ''}`}
              onClick={() => setPaintStyle(t)}
            >
              <span
                class="paint-swatch"
                style={{ backgroundColor: def.swatch, backgroundImage: swatchImage(t) }}
              />
              <span class="paint-chip-name">{def.name}</span>
              <span class="paint-chip-price">{locked ? P.rank(def.rank) : P.each(def.price)}</span>
            </button>
          );
        })}
      </div>
      <div class={`paint-hint${res && !res.ok ? ' paint-hint--bad' : ''}`} role="status">
        {hint}
      </div>
      <button type="button" class="btn btn--small btn--basil paint-done" onClick={exitBuild}>
        {P.done}
      </button>
    </div>
  );
}
