import { DAY_CLOSE_MINUTE } from '../../data/balance';
import { FURNITURE } from '../../data/furniture';
import { STRINGS } from '../../data/strings';
import { formatClock } from '../../sim/time';
import {
  buildMode,
  cancelPlacing,
  confirmPlacing,
  enterBuild,
  exitBuild,
  ghost,
  rotateGhost,
  shopOpen,
} from '../build';
import { dispatch, phase } from '../store';

const B = STRINGS.build;

/** Short line above the placement buttons: why it is invalid, a warning, or what it costs. */
function PlacementHint() {
  const g = ghost.value;
  if (!g) return null;
  const def = FURNITURE[g.placing.defId];
  let text: string;
  let tone: 'bad' | 'warn' | 'info';
  if (!g.result.ok) {
    text = B.reasons[g.result.reason] ?? g.result.reason;
    tone = 'bad';
  } else if (g.orphanChair) {
    text = B.noTable;
    tone = 'warn';
  } else {
    text = g.placing.kind === 'new' ? B.cost(def.name, def.price) : B.moving(def.name);
    tone = 'info';
  }
  return (
    <div class={`build-hint build-hint--${tone}`} role="status">
      {text}
    </div>
  );
}

/** Bottom bar: Shop / Build / Open! in prep, placement controls in build mode, status while open. */
export function ActionBar() {
  const p = phase.value;
  if (p === 'prep') {
    const g = ghost.value;
    if (g) {
      return (
        <div class="bottom-bar">
          <PlacementHint />
          <div class="bar-row">
            <button type="button" class="btn btn--small btn--crust" onClick={rotateGhost}>
              {B.rotate}
            </button>
            <button
              type="button"
              class="btn btn--small btn--basil"
              disabled={!g.result.ok}
              onClick={confirmPlacing}
            >
              {B.confirm}
            </button>
            <button type="button" class="btn btn--small btn--paper" onClick={cancelPlacing}>
              {B.cancel}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div class="bottom-bar">
        <div class="bar-row">
          <button
            type="button"
            class="btn btn--small btn--saffron"
            onClick={() => {
              shopOpen.value = true;
            }}
          >
            {B.shopButton}
          </button>
          {buildMode.value ? (
            <button type="button" class="btn btn--small btn--basil" onClick={exitBuild}>
              {B.doneButton}
            </button>
          ) : (
            <>
              <button type="button" class="btn btn--small btn--sky" onClick={enterBuild}>
                {B.buildButton}
              </button>
              <button
                type="button"
                class="btn btn--small btn--tomato"
                onClick={() => dispatch({ type: 'openRestaurant' })}
              >
                {STRINGS.openButton}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  if (p === 'open' || p === 'closing') {
    return (
      <div class="bottom-bar">
        <div class="status-pill" role="status">
          <span class={`status-dot status-dot--${p}`} aria-hidden="true" />
          {p === 'open' ? STRINGS.statusOpen(formatClock(DAY_CLOSE_MINUTE)) : STRINGS.statusClosing}
        </div>
      </div>
    );
  }
  return null;
}
