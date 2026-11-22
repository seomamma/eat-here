import { DAY_CLOSE_MINUTE } from '../../data/balance';
import { STRINGS } from '../../data/strings';
import { formatClock } from '../../sim/time';
import { dispatch, phase } from '../store';

/** Bottom bar: the "Open!" button in prep, a status pill while the restaurant is running. */
export function ActionBar() {
  const p = phase.value;
  if (p === 'prep') {
    return (
      <div class="bottom-bar">
        <button
          type="button"
          class="btn btn--tomato btn--primary"
          onClick={() => dispatch({ type: 'openRestaurant' })}
        >
          {STRINGS.openButton}
        </button>
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
