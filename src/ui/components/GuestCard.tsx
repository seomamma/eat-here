import { HAPPINESS_PER_STAR, HAPPINESS_MAX, STAR_COUNT } from '../../data/happiness';
import { STRINGS } from '../../data/strings';
import { selectGuest } from '../selection';
import { guestCard } from '../store';
import { Card } from './Card';

const STAR_PATH = 'M10 1l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L10 14.8 4.4 18l1.4-6.2L1 7.5l6.4-.7z';

function Stars(props: { count: number }) {
  const row = (cls: string) => (
    <svg class={`stars-row ${cls}`} viewBox={`0 0 ${STAR_COUNT * 20} 19`} aria-hidden="true">
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <path key={i} d={STAR_PATH} transform={`translate(${i * 20} 0)`} />
      ))}
    </svg>
  );
  const pct = Math.min(100, (props.count / STAR_COUNT) * 100);
  return (
    <div
      class="stars"
      role="img"
      aria-label={STRINGS.guestCard.stars(props.count)}
      style={{ '--stars-w': `${pct}%` }}
    >
      {row('stars-empty')}
      <div class="stars-clip">{row('stars-full')}</div>
    </div>
  );
}

/** Info card of the tapped guest: stars, what made them happy, and what they are doing. */
export function GuestCard() {
  const g = guestCard.value;
  if (!g) return null;
  const S = STRINGS.guestCard;
  const stars = Math.min(STAR_COUNT, g.happiness / HAPPINESS_PER_STAR);
  return (
    <div class="guest-card interactive">
      <Card accent="sky">
        <div class="guest-head">
          <h2 class="guest-name">{g.name}</h2>
          <button
            type="button"
            class="close-btn"
            aria-label={S.close}
            onClick={() => selectGuest(null)}
          >
            ×
          </button>
        </div>
        <Stars count={stars} />
        <p class="guest-meta">
          {S.happiness(Math.round(Math.min(HAPPINESS_MAX, g.happiness)))} · {S.phases[g.phase]}
        </p>
        <ul class="guest-reasons">
          {g.log.length === 0 ? (
            <li class="guest-reason guest-reason--none">{S.noReasons}</li>
          ) : (
            g.log.map((e, i) => (
              <li class="guest-reason" key={i}>
                <span>{S.reasons[e.reason]}</span>
                <span class="guest-points">+{e.points}</span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
