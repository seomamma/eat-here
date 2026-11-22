import { DAY_CLOSE_MINUTE } from '../../data/balance';
import { STRINGS } from '../../data/strings';
import { formatClock } from '../../sim/time';
import { buildMode, exitBuild, ghost, menuOpen } from '../build';
import { phase, report } from '../store';
import { PizzaSliceIcon } from './MenuIcons';

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
 * Bottom of the screen: status pill and the round Menu button (bottom-centre). While a piece is
 * being placed the Menu is hidden (the controls float by the ghost). Hidden at night and while
 * the day report is open.
 */
export function ActionBar() {
  if (phase.value === 'night' || phase.value === 'report' || report.value) return null;
  const placing = ghost.value !== null;
  return (
    <div class="bottom-bar">
      <StatusPill />
      {!placing && (
        <div class="menu-row">
          <button
            type="button"
            class="menu-btn"
            aria-label={STRINGS.menu.title}
            aria-expanded={menuOpen.value}
            onClick={() => {
              menuOpen.value = !menuOpen.value;
            }}
          >
            <PizzaSliceIcon />
            <span class="menu-btn-label">{STRINGS.menu.button}</span>
          </button>
          {buildMode.value && (
            <button type="button" class="btn btn--small btn--basil done-btn" onClick={exitBuild}>
              {STRINGS.build.doneButton}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
