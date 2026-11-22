import { FURNITURE } from '../../data/furniture';
import { INGREDIENTS, INGREDIENT_IDS, type IngredientId } from '../../data/ingredients';
import { RECIPES, RECIPE_IDS } from '../../data/recipes';
import { SHOP_CATEGORIES, shopItemsOf, unlockRank } from '../../data/shop';
import { STRINGS } from '../../data/strings';
import { shopCategory, shopOpen, shopTab, startPaintMode, startPlacingNew } from '../build';
import { furnitureIconUrl } from '../../view/furnitureIcons';
import { effectLines } from '../pieceInfo';
import { dispatch, inventory, market, money, rank } from '../store';
import { Card } from './Card';
import { IngredientIcon, RarityBadge } from './Icons';

/** "For Margherita Lv.2" lines: which dish levels the ingredient is used for. */
function usedFor(ingredient: IngredientId): string {
  const uses: string[] = [];
  for (const id of RECIPE_IDS) {
    for (const u of RECIPES[id].upgrades) {
      if (u.ingredient === ingredient) uses.push(STRINGS.shop.usedFor(RECIPES[id].name, u.level));
    }
  }
  return uses.join(', ');
}

/** Small chips with the ingredients the player owns. */
export function PantryChips() {
  const S = STRINGS.shop;
  const owned = INGREDIENT_IDS.filter((id) => (inventory.value[id] ?? 0) > 0);
  return (
    <div class="pantry">
      <span class="pantry-label">{S.pantry}</span>
      <div class="chips">
        {owned.length === 0 && <span class="pantry-empty">{S.pantryEmpty}</span>}
        {owned.map((id) => (
          <span
            class={`chip chip--${INGREDIENTS[id].rarity}`}
            key={id}
            title={INGREDIENTS[id].name}
            aria-label={`${INGREDIENTS[id].name} x${inventory.value[id]}`}
          >
            <IngredientIcon id={id} size={18} />
            <b>{inventory.value[id]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function MarketTab() {
  const S = STRINGS.shop;
  const have = money.value;
  return (
    <>
      <ul class="shop-list">
        {market.value.offers.map((offer, index) => {
          const def = INGREDIENTS[offer.ingredient];
          return (
            <li class={`shop-item${offer.bought ? ' shop-item--sold' : ''}`} key={index}>
              <IngredientIcon id={offer.ingredient} size={48} />
              <div class="shop-info">
                <span class="shop-name">{def.name}</span>
                <span class="shop-meta">
                  <RarityBadge rarity={def.rarity} />
                </span>
                <span class="shop-appeal shop-appeal--info">{usedFor(offer.ingredient)}</span>
              </div>
              {offer.bought ? (
                <span class="sold-out">{S.soldOut}</span>
              ) : (
                <button
                  type="button"
                  class="btn btn--small btn--basil shop-buy"
                  disabled={have < offer.price}
                  onClick={() => dispatch({ type: 'buyMarketOffer', index })}
                >
                  {S.buy} {offer.price}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p class="market-note">{S.marketTomorrow}</p>
      <PantryChips />
    </>
  );
}

function FurnitureTab() {
  const S = STRINGS.shop;
  const have = money.value;
  const cat = shopCategory.value;
  const items = shopItemsOf(cat);
  return (
    <>
      <div class="chips cat-chips" role="tablist">
        {SHOP_CATEGORIES.map((c) => (
          <button
            type="button"
            role="tab"
            key={c}
            aria-selected={cat === c}
            class={`cat-chip${cat === c ? ' cat-chip--on' : ''}`}
            onClick={() => {
              shopCategory.value = c;
            }}
          >
            {S.categories[c]}
          </button>
        ))}
      </div>
      <ul class="shop-list">
        {items.length === 0 && <li class="guest-reason guest-reason--none">{S.kitchenNote}</li>}
        {items.map((defId) => {
          const def = FURNITURE[defId];
          const need = unlockRank(defId);
          const locked = rank.value < need;
          return (
            <li class={`shop-item${locked ? ' shop-item--locked' : ''}`} key={defId}>
              <img class="shop-sprite" src={furnitureIconUrl(defId)} alt="" aria-hidden="true" />
              <div class="shop-info">
                <span class="shop-name">{def.name}</span>
                {effectLines(defId, 1, false).map((l) => (
                  <span class="shop-appeal" key={l}>
                    {l}
                  </span>
                ))}
              </div>
              {locked ? (
                <span class="rank-lock">{S.rank(need)}</span>
              ) : (
                <button
                  type="button"
                  class="btn btn--small btn--basil shop-buy"
                  disabled={have < def.price}
                  onClick={() => startPlacingNew(defId)}
                >
                  {S.buy} {def.price}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" class="paint-entry" onClick={startPaintMode}>
        <span class="paint-entry-title">{S.floorsWalls}</span>
        <span class="paint-entry-sub">{S.floorsWallsInfo}</span>
      </button>
    </>
  );
}

/** Slides in from the bottom (portrait) or the right (landscape); Furniture and Market tabs. */
export function ShopPanel() {
  if (!shopOpen.value) return null;
  const S = STRINGS.shop;
  const tab = shopTab.value;
  return (
    <div class="shop-panel interactive" role="dialog" aria-label={S.title}>
      <Card accent="saffron">
        <div class="guest-head">
          <h2 class="guest-name">{S.title}</h2>
          <button
            type="button"
            class="close-btn"
            aria-label={S.close}
            onClick={() => {
              shopOpen.value = false;
            }}
          >
            ×
          </button>
        </div>
        <div class="tabs" role="tablist">
          {(['furniture', 'market'] as const).map((t) => (
            <button
              type="button"
              role="tab"
              key={t}
              aria-selected={tab === t}
              class={`tab${tab === t ? ' tab--on' : ''}`}
              onClick={() => {
                shopTab.value = t;
              }}
            >
              {t === 'furniture' ? S.tabFurniture : S.tabMarket}
            </button>
          ))}
        </div>
        {tab === 'furniture' ? <FurnitureTab /> : <MarketTab />}
      </Card>
    </div>
  );
}
