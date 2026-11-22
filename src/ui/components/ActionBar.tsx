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
  openRecipes,
  openShop,
  rotateGhost,
} from '../build';
import { phase, report } from '../store';

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

/** Open / Closing status; replaced by the pause notice while building. */
function StatusPill() {
  const p = phase.value;
  if (buildMode.value) {
    return (
      <div class="status-pill status-pill--paused" role="status">
        <span class="status-dot status-dot--paused" aria-hidden="true" />
        {STRINGS.pausedWhileBuilding}
      </div>
    );
  }
  return (
    <div class="status-pill" role="status">
      <span class={`status-dot status-dot--${p}`} aria-hidden="true" />
      {p === 'closing' ? STRINGS.statusClosing : STRINGS.statusOpen(formatClock(DAY_CLOSE_MINUTE))}
    </div>
  );
}

/**
 * Bottom bar: status pill plus Shop / Build in any phase, placement controls while a piece is
 * being placed. Hidden at night and while the day report is open.
 */
export function ActionBar() {
  if (phase.value === 'night' || phase.value === 'report' || report.value) return null;
  const g = ghost.value;
  return (
    <div class="bottom-bar">
      {g && <PlacementHint />}
      <StatusPill />
      {g ? (
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
      ) : (
        <div class="bar-row">
          <button type="button" class="btn btn--small btn--saffron" onClick={() => openShop()}>
            {B.shopButton}
          </button>
          <button type="button" class="btn btn--small btn--tomato" onClick={openRecipes}>
            {B.recipesButton}
          </button>
          {buildMode.value ? (
            <button type="button" class="btn btn--small btn--basil" onClick={exitBuild}>
              {B.doneButton}
            </button>
          ) : (
            <button type="button" class="btn btn--small btn--sky" onClick={enterBuild}>
              {B.buildButton}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
