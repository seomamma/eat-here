import { STRINGS } from '../../data/strings';
import { formatHour, weekdayIndex } from '../../sim/time';
import { RANKS, rankDef } from '../../data/ranks';
import { todayOpen } from '../build';
import { day, fame, minuteOfDay, money, phase, rank } from '../store';
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

/** Sun while the restaurant is open, moon at night. */
function TimeIcon(props: { night: boolean }) {
  return props.night ? (
    <svg class="time-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16 3a9 9 0 1 0 5 15 7.5 7.5 0 0 1-5-15z"
        fill="var(--saffron)"
        stroke="var(--ink)"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
    </svg>
  ) : (
    <svg class="time-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </g>
      <circle cx="12" cy="12" r="5" fill="var(--saffron)" stroke="var(--ink)" stroke-width="2.5" />
    </svg>
  );
}

/** Rank name and progress to the next rank (full bar at the top rank). */
function FameBar() {
  const current = rankDef(rank.value);
  const next = RANKS[rank.value];
  const total = next ? next.fame - current.fame : 1;
  const done = next ? Math.max(0, fame.value - current.fame) : 1;
  const pct = Math.min(100, Math.round((done / total) * 100));
  return (
    <div class="fame" role="status" aria-label={STRINGS.fame.label}>
      <div class="fame-name">
        <span class="fame-rank">{STRINGS.fame.rank(current.rank)}</span>
        <span class="fame-title">{current.name}</span>
      </div>
      <div class="fame-bar">
        <div
          class={`fame-fill${pct === 0 ? ' fame-fill--empty' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span class="fame-text">
        {next ? STRINGS.fame.progress(fame.value, next.fame) : STRINGS.fame.max}
      </span>
    </div>
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
          <TimeIcon night={phase.value === 'night'} />
          {STRINGS.hudDayLine(
            day.value,
            STRINGS.weekdays[weekdayIndex(day.value)] ?? '',
            phase.value === 'night' ? STRINGS.hudNight : formatHour(minuteOfDay.value),
          )}
        </p>
      </Card>
      <Card accent="saffron">
        <button
          type="button"
          class="money money-btn"
          aria-label={`${STRINGS.moneyLabel}: ${amount}. ${STRINGS.today.open}`}
          aria-expanded={todayOpen.value}
          onClick={() => {
            todayOpen.value = !todayOpen.value;
          }}
        >
          <CoinIcon />
          {/* Re-keyed on every change so the bump animation restarts. */}
          <span class="money-amount" key={amount}>
            {amount}
          </span>
        </button>
      </Card>
      <Card accent="saffron" class="fame-card">
        <FameBar />
      </Card>
    </div>
  );
}
