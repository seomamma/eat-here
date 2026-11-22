import { STRINGS } from '../../data/strings';
import { formatClock, weekdayIndex } from '../../sim/time';
import { day, minuteOfDay, money } from '../store';
import { Card } from './Card';

function CoinIcon() {
  return (
    <svg class="coin-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--saffron)" stroke="var(--ink)" stroke-width="3" />
      <path
        d="M12 7v10M9 10c0-2 6-2 6 0s-6 2-6 4 6 2 6 0"
        fill="none"
        stroke="var(--ink)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** Top bar: title card and the money card (saffron accent bumps whenever money changes). */
export function Hud() {
  const amount = money.value;
  return (
    <div class="top-bar">
      <Card accent="tomato">
        <h1 class="card-title">{STRINGS.gameTitle}</h1>
        <p class="card-subtitle">
          {STRINGS.hudDayLine(
            day.value,
            STRINGS.weekdays[weekdayIndex(day.value)] ?? '',
            formatClock(minuteOfDay.value),
          )}
        </p>
      </Card>
      <Card accent="saffron">
        <div class="money" role="status" aria-label={STRINGS.moneyLabel}>
          <CoinIcon />
          {/* Re-keyed on every change so the bump animation restarts. */}
          <span class="money-amount" key={amount}>
            {amount}
          </span>
        </div>
      </Card>
    </div>
  );
}
