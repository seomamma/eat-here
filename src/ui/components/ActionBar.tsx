import { STRINGS } from '../../data/strings';
import { buildMode, exitBuild, ghost, menuOpen } from '../build';
import { phase, report } from '../store';
import { PizzaSliceIcon } from './MenuIcons';

/**
 * Bottom-left of the screen: the round Menu button. While a piece is
 * being placed the Menu is hidden (the controls float by the ghost). Hidden at night and while
 * the day report is open.
 */
export function ActionBar() {
  if (phase.value === 'night' || phase.value === 'report' || report.value) return null;
  const placing = ghost.value !== null;
  return (
    <div class="bottom-bar">
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
