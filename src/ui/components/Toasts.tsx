import { INGREDIENTS } from '../../data/ingredients';
import { QUALITY_PER_LEVEL } from '../../data/happiness';
import { RECIPES } from '../../data/recipes';
import { STRINGS } from '../../data/strings';
import { priceAtLevel } from '../../sim/systems/recipes';
import { dismissToast, toasts } from '../store';
import { Card } from './Card';
import { DishIcon, IngredientIcon } from './Icons';

const COLORS = ['var(--tomato)', 'var(--saffron)', 'var(--basil)', 'var(--sky)'];
const PIECES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 60 + ((i * 37) % 40);
  return {
    left: 8 + ((i * 53) % 84),
    dx: Math.round(Math.cos(angle) * reach),
    dy: -20 - ((i * 29) % 30),
    rot: (i * 71) % 360,
    color: COLORS[i % COLORS.length] ?? 'var(--saffron)',
  };
});

/** Small confetti burst, one-shot (the big RANK UP confetti falls forever; this one pops). */
function Burst() {
  return (
    <div class="confetti confetti--burst" aria-hidden="true">
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

/** Self-dismissing feedback cards at the top: level ups and gifts. They never pause the sim. */
export function Toasts() {
  const list = toasts.value;
  if (list.length === 0) return null;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) =>
        t.kind === 'level' ? (
          <div class="toast toast--level interactive" key={t.id} onClick={() => dismissToast(t.id)}>
            <Burst />
            <Card accent="saffron">
              <div class="toast-row">
                <DishIcon id={t.recipeId} size={48} />
                <div class="toast-text">
                  <span class="toast-title">{STRINGS.levelUp.title}</span>
                  <span class="toast-line">
                    {STRINGS.levelUp.reached(RECIPES[t.recipeId].name, t.level)}
                  </span>
                  <span class="toast-sub">
                    {STRINGS.levelUp.newPrice(priceAtLevel(t.recipeId, t.level))} {'·'}{' '}
                    {STRINGS.levelUp.tastiness(QUALITY_PER_LEVEL)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div
            class={`toast toast--gift${INGREDIENTS[t.ingredient].rarity === 'rare' ? ' toast--rare' : ''} interactive`}
            key={t.id}
            onClick={() => dismissToast(t.id)}
          >
            <Card accent={INGREDIENTS[t.ingredient].rarity === 'rare' ? 'saffron' : 'basil'}>
              <div class="toast-row">
                <IngredientIcon id={t.ingredient} size={40} />
                <span class="toast-line">
                  {STRINGS.gift.received(t.guestName, INGREDIENTS[t.ingredient].name)}
                </span>
              </div>
            </Card>
          </div>
        ),
      )}
    </div>
  );
}
