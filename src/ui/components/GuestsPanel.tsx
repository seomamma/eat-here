import { MAX_HEARTS, regularDef } from '../../data/regulars';
import { RECIPES } from '../../data/recipes';
import { STRINGS } from '../../data/strings';
import { weekdayIndex } from '../../sim/time';
import { guestsOpen } from '../build';
import { regularViews, type RegularView } from '../store';
import { Card } from './Card';
import { DishIcon } from './Icons';
import { HeartIcon, MomentArt } from './MomentIcons';

const G = STRINGS.guestsBook;

export function Hearts(props: { count: number }) {
  return (
    <span class="hearts" role="img" aria-label={STRINGS.guestCard.hearts(props.count)}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <HeartIcon key={i} on={i < props.count} />
      ))}
    </span>
  );
}

function RegularRow(props: { view: RegularView }) {
  const v = props.view;
  const def = regularDef(v.id);
  if (!v.unlocked) {
    return (
      <li class="regular regular--locked">
        <MomentArt icon={def.look} size={48} locked />
        <div class="regular-main">
          <span class="shop-name">{G.locked}</span>
          <span class="regular-hint">{def.unlock.hint}</span>
        </div>
      </li>
    );
  }
  const weekday = STRINGS.weekdays[weekdayIndex(v.nextVisit)] ?? '';
  return (
    <li class="regular">
      <MomentArt icon={def.look} size={48} />
      <div class="regular-main">
        <span class="shop-name">{def.name}</span>
        <Hearts count={v.hearts} />
        <span class="regular-fav">
          <DishIcon id={def.favorite} size={22} />
          {G.favorite}: {RECIPES[def.favorite].name}
        </span>
        <span class="regular-next">
          {v.today ? G.today(weekday) : G.nextVisit(weekday, v.nextVisit)} {'·'}{' '}
          {G.visits(v.visits)}
        </span>
      </div>
    </li>
  );
}

/** Guests book: the regulars you met (look, favorite, hearts, next visit) and hints for the rest. */
export function GuestsPanel() {
  if (!guestsOpen.value) return null;
  return (
    <div class="shop-panel recipe-panel interactive" role="dialog" aria-label={G.title}>
      <Card accent="sky">
        <div class="guest-head">
          <h2 class="guest-name">{G.title}</h2>
          <button
            type="button"
            class="close-btn"
            aria-label={G.close}
            onClick={() => {
              guestsOpen.value = false;
            }}
          >
            ×
          </button>
        </div>
        <ul class="recipe-list">
          {regularViews.value.map((v) => (
            <RegularRow key={v.id} view={v} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
