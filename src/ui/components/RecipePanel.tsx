import { INGREDIENTS } from '../../data/ingredients';
import { RECIPES, RECIPE_IDS, type RecipeId } from '../../data/recipes';
import { MAX_RECIPE_LEVEL } from '../../data/balance';
import { STRINGS } from '../../data/strings';
import { nextUpgrade, priceAtLevel, validateUpgrade } from '../../sim/systems/recipes';
import { recipesOpen } from '../build';
import { dispatch, inventory, money, phase, recipeStates } from '../store';
import { Card } from './Card';
import { CoinGlyph, DishIcon, IngredientIcon, RarityBadge } from './Icons';
import { PantryChips } from './ShopPanel';

const R = STRINGS.recipes;

function Pips(props: { level: number }) {
  return (
    <span class="pips" aria-label={R.level(props.level)}>
      {Array.from({ length: MAX_RECIPE_LEVEL }, (_, i) => (
        <i key={i} class={i < props.level ? 'pip pip--on' : 'pip'} />
      ))}
    </span>
  );
}

function RecipeCard(props: { id: RecipeId }) {
  const def = RECIPES[props.id];
  const state = recipeStates.value[props.id];
  if (!state) return null;
  if (!state.unlocked) {
    const rank = def.unlock === 'start' ? 1 : def.unlock.rank;
    return (
      <li class="recipe recipe--locked">
        <DishIcon id={props.id} />
        <div class="recipe-main">
          <span class="shop-name">{def.name}</span>
          <span class="recipe-lock">{R.unlocksAt(rank)}</span>
        </div>
      </li>
    );
  }
  const up = nextUpgrade(props.id, state.level);
  const price = priceAtLevel(props.id, state.level);
  const check = validateUpgrade(
    {
      phase: phase.value,
      money: money.value,
      inventory: inventory.value,
      recipes: recipeStates.value,
    },
    props.id,
  );
  const owned = up?.ingredient ? (inventory.value[up.ingredient] ?? 0) : 0;
  const ing = up?.ingredient ? INGREDIENTS[up.ingredient] : null;
  return (
    <li class="recipe">
      <DishIcon id={props.id} />
      <div class="recipe-main">
        <div class="recipe-head">
          <span class="shop-name">{def.name}</span>
          <Pips level={state.level} />
        </div>
        <div class="recipe-price">
          <b>{R.price(price)}</b>
          {up && (
            <span class="recipe-next-price">{R.nextPrice(priceAtLevel(props.id, up.level))}</span>
          )}
        </div>
        {up ? (
          <div class="recipe-upgrade">
            {up.ingredient && ing ? (
              <IngredientIcon id={up.ingredient} size={34} />
            ) : (
              <CoinGlyph size={34} />
            )}
            <div class="recipe-ing">
              <span class="recipe-ing-name">{R.nextLevel(up.level)}</span>
              {ing ? (
                <span class="recipe-ing-item">{ing.name}</span>
              ) : (
                <span class="shop-meta">{R.coinsOnly}</span>
              )}
            </div>
            <div class="recipe-action">
              <button
                type="button"
                class="btn btn--small btn--basil shop-buy"
                disabled={!check.ok}
                onClick={() => dispatch({ type: 'upgradeRecipe', recipeId: props.id })}
              >
                <span>{R.upgrade}</span>
                <small>{up.coins}</small>
              </button>
            </div>
          </div>
        ) : (
          <div class="recipe-max">{R.maxLevel}</div>
        )}
        {up && ing && (
          <div class="shop-meta recipe-ing-meta">
            <RarityBadge rarity={ing.rarity} />
            <span class={owned > 0 ? 'owned owned--yes' : 'owned'}>{R.owned(owned)}</span>
            {ing.rarity === 'exclusive' && (
              <span class="exclusive-hint">{STRINGS.exclusiveHint}</span>
            )}
          </div>
        )}
        {up && !check.ok && (
          <div class="recipe-reason" role="status">
            {R.reasons[check.reason] ?? check.reason}
          </div>
        )}
      </div>
    </li>
  );
}

/** Recipe book: every dish with level, price and its next upgrade. Same slot as the shop. */
export function RecipePanel() {
  if (!recipesOpen.value) return null;
  return (
    <div class="shop-panel recipe-panel interactive" role="dialog" aria-label={R.title}>
      <Card accent="tomato">
        <div class="guest-head">
          <h2 class="guest-name">{R.title}</h2>
          <button
            type="button"
            class="close-btn"
            aria-label={STRINGS.shop.close}
            onClick={() => {
              recipesOpen.value = false;
            }}
          >
            ×
          </button>
        </div>
        <ul class="recipe-list">
          {RECIPE_IDS.map((id) => (
            <RecipeCard key={id} id={id} />
          ))}
        </ul>
        <PantryChips />
      </Card>
    </div>
  );
}
