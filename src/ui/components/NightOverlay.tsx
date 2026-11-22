import { STRINGS } from '../../data/strings';
import { day, phase } from '../store';
import { Card } from './Card';

/**
 * Night transition: the world darkens, a moon and the coming day's number show for the night
 * duration, then everything fades back. Always mounted so the fade runs in both directions.
 */
export function NightOverlay() {
  const night = phase.value === 'night';
  return (
    <div class={`night-overlay${night ? ' night-overlay--on' : ''}`} aria-hidden={!night}>
      <div class="night-card">
        <Card accent="sky">
          <svg class="night-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M16 3a9 9 0 1 0 5 15 7.5 7.5 0 0 1-5-15z"
              fill="var(--saffron)"
              stroke="var(--ink)"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
          <h2 class="night-day">{STRINGS.night.day(day.value + 1)}</h2>
        </Card>
      </div>
    </div>
  );
}
