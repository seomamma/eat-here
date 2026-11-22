import { FURNITURE, type FurnitureDefId } from '../../data/furniture';
import { SHOP_ITEMS } from '../../data/shop';
import { STRINGS } from '../../data/strings';
import { shopOpen, startPlacingNew } from '../build';
import { money } from '../store';
import { Card } from './Card';

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

/** Slides in from the bottom (portrait) or the right (landscape); lists what can be bought. */
export function ShopPanel() {
  if (!shopOpen.value) return null;
  const S = STRINGS.shop;
  const have = money.value;
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
      </Card>
    </div>
  );
}
