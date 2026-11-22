import { FURNITURE, type FurnitureDefId } from '../../data/furniture';
import { INGREDIENTS, INGREDIENT_IDS, type IngredientId } from '../../data/ingredients';
import { RECIPES, RECIPE_IDS } from '../../data/recipes';
import { SHOP_ITEMS } from '../../data/shop';
import { STRINGS } from '../../data/strings';
import { shopOpen, shopTab, startPlacingNew } from '../build';
import { dispatch, inventory, market, money } from '../store';
import { Card } from './Card';
import { IngredientIcon, RarityBadge } from './Icons';

/** Simple vector preview per item; unknown items fall back to a plain box. */
function ShopIcon(props: { defId: FurnitureDefId }) {
  if (props.defId === 'plant_potted') {
    return (
      <svg class="shop-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M16 18C8 16 6 8 7 4c7 0 10 5 9 14z"
          fill="var(--basil)"
          stroke="var(--ink)"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M16 18c1-8 5-12 10-12 1 5-2 11-10 12z"
          fill="var(--basil)"
          stroke="var(--ink)"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M8 19h16l-2 10H10z"
          fill="var(--crust)"
          stroke="var(--ink)"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg class="shop-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="3"
        fill="var(--crust)"
        stroke="var(--ink)"
        stroke-width="2"
      />
    </svg>
  );
}

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
  return (
    <ul class="shop-list">
      {SHOP_ITEMS.length === 0 && <li class="guest-reason guest-reason--none">{S.empty}</li>}
      {SHOP_ITEMS.map((defId) => {
        const def = FURNITURE[defId];
        return (
          <li class="shop-item" key={defId}>
            <ShopIcon defId={defId} />
            <div class="shop-info">
              <span class="shop-name">{def.name}</span>
              <span class="shop-appeal">{S.appeal(def.appeal[0] ?? 0)}</span>
            </div>
            <button
              type="button"
              class="btn btn--small btn--basil shop-buy"
              disabled={have < def.price}
              onClick={() => startPlacingNew(defId)}
            >
              {S.buy} {def.price}
            </button>
          </li>
        );
      })}
    </ul>
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
