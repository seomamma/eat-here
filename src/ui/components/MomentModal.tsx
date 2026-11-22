import { INGREDIENTS } from '../../data/ingredients';
import { STRINGS } from '../../data/strings';
import { dismissMoment, moments, rankUps } from '../store';
import { Card } from './Card';
import { IngredientIcon } from './Icons';
import { MomentArt } from './MomentIcons';

/**
 * Celebratory card for a moment (regular unlocks, story beats). The sim is paused while it is
 * open; several queue up. A RANK UP waits in front of it.
 */
export function MomentModal() {
  const info = moments.value[0];
  if (!info || rankUps.value.length > 0) return null;
  const S = STRINGS.moment;
  const { card, reward } = info;
  return (
    <div class="modal-backdrop interactive moment" key={info.id}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={card.title}>
        <Card accent="basil">
          <div class="moment-body">
            <div class="moment-art-wrap">
              <MomentArt icon={card.icon} size={72} />
            </div>
            <h2 class="modal-title moment-title">{card.title}</h2>
            <p class="moment-text">{card.text}</p>
            {reward && (
              <div class="moment-rewards">
                {reward.unlockRegular && <span class="chip chip--basil">{S.regularJoined}</span>}
                {reward.coins ? (
                  <span class="chip chip--saffron">{S.coins(reward.coins)}</span>
                ) : null}
                {reward.fame ? <span class="chip chip--saffron">{S.fame(reward.fame)}</span> : null}
                {reward.ingredient && (
                  <span class="chip chip--ingredient">
                    <IngredientIcon id={reward.ingredient} size={24} />
                    {INGREDIENTS[reward.ingredient].name}
                  </span>
                )}
              </div>
            )}
          </div>
          <button type="button" class="btn btn--basil btn--primary" onClick={dismissMoment}>
            {S.button}
          </button>
        </Card>
      </div>
    </div>
  );
}
