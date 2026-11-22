import { STRINGS, growthText } from '../../data/strings';
import { dismissRankUp, rankUps } from '../store';
import { INGREDIENTS } from '../../data/ingredients';
import { Card } from './Card';
import { IngredientIcon } from './Icons';

const CONFETTI_COLORS = ['var(--tomato)', 'var(--saffron)', 'var(--basil)', 'var(--sky)'];
const CONFETTI_COUNT = 28;

/** Deterministic pseudo-random pieces (pure CSS animation, no dependency). */
const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 20) / 10,
  duration: 2.2 + ((i * 29) % 15) / 10,
  rotate: (i * 71) % 360,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 'var(--saffron)',
}));

/** Full-screen celebration when the restaurant ranks up; the sim is paused while it is open. */
export function RankUpModal() {
  const info = rankUps.value[0];
  if (!info) return null;
  const S = STRINGS.rankUp;
  return (
    <div class="modal-backdrop interactive rankup" key={info.rank}>
      <div class="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i
            key={i}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              '--rot': `${c.rotate}deg`,
            }}
          />
        ))}
      </div>
      <div class="modal" role="dialog" aria-modal="true" aria-label={S.title}>
        <Card accent="saffron">
          <div class="rankup-body">
            <div class="rank-badge" aria-hidden="true">
              <span class="rank-badge-num">{info.rank}</span>
            </div>
            <div class="rankup-text">
              <h2 class="modal-title rankup-title">{S.title}</h2>
              <p class="rankup-name">{info.name}</p>
              {info.unlocks.length > 0 && (
                <div class="rankup-unlocks">
                  <p class="rankup-unlocked">{S.unlocked}</p>
                  <ul>
                    {info.unlocks.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}
              {info.space && (
                <div class="rankup-unlocks">
                  <p class="rankup-unlocked">{S.space}</p>
                  <ul>
                    <li>{growthText(info.space)}</li>
                  </ul>
                </div>
              )}
              {info.reward && (
                <div class="rankup-reward">
                  <IngredientIcon id={info.reward} size={36} />
                  <span>
                    <span class="rankup-unlocked">{S.reward}</span>
                    <span class="rankup-reward-name">{INGREDIENTS[info.reward].name}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <button type="button" class="btn btn--basil btn--primary" onClick={dismissRankUp}>
            {S.button}
          </button>
        </Card>
      </div>
    </div>
  );
}
