import { INGREDIENTS, type IngredientId, type Rarity } from '../../data/ingredients';
import type { RecipeId } from '../../data/recipes';
import { STRINGS } from '../../data/strings';

const STROKE = { stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' } as const;

/** Chunky placeholder shape per ingredient, tinted with the ingredient's colour. */
function IngredientShape(props: { id: IngredientId }) {
  const fill = INGREDIENTS[props.id].color;
  switch (props.id) {
    case 'sicilian_oregano':
    case 'nonnas_secret_basil':
      return (
        <>
          <path d="M5 19C4 9 11 4 20 4c1 9-4 16-15 15z" fill={fill} {...STROKE} />
          <path d="M5 19L15 9" fill="none" {...STROKE} />
        </>
      );
    case 'black_garlic':
    case 'hot_honey':
      return (
        <>
          <rect x="6" y="10" width="13" height="12" rx="3" fill={fill} {...STROKE} />
          <rect x="7" y="5" width="11" height="5" rx="1.5" fill="var(--paper)" {...STROKE} />
        </>
      );
    case 'san_marzano':
      return (
        <>
          <ellipse cx="12.5" cy="14" rx="8" ry="8" fill={fill} {...STROKE} />
          <path d="M8 7l4.5 3L17 7l-2 4h-5z" fill="var(--basil)" {...STROKE} />
        </>
      );
    case 'buffalo_mozzarella':
      return (
        <>
          <circle cx="12.5" cy="13" r="8.5" fill={fill} {...STROKE} />
          <path d="M8 10a5 5 0 0 1 4-2.5" fill="none" stroke="var(--ink)" stroke-width="1.6" />
        </>
      );
    case 'aged_parmesan':
      return (
        <>
          <path d="M3 18L19 7l3 11z" fill={fill} {...STROKE} />
          <circle cx="16" cy="14.5" r="1.2" fill="var(--ink)" />
          <circle cx="11" cy="16" r="1.2" fill="var(--ink)" />
        </>
      );
    case 'calabrian_chili':
      return (
        <>
          <path d="M4 13l5-4 3 4-4 4zM12 15l4-5 4 3-3 5zM9 19l4 2-4 1z" fill={fill} {...STROKE} />
        </>
      );
  }
}

/** Ingredient icon in a square; rare ingredients get a round saffron frame, exclusive ones a tomato frame. */
export function IngredientIcon(props: { id: IngredientId; size?: number }) {
  const { rarity } = INGREDIENTS[props.id];
  const size = props.size ?? 44;
  return (
    <span
      class={`ing-icon ing-icon--${rarity}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 25 25" width="100%" height="100%">
        <IngredientShape id={props.id} />
      </svg>
    </span>
  );
}

export function RarityBadge(props: { rarity: Rarity }) {
  return <span class={`badge badge--${props.rarity}`}>{STRINGS.rarity[props.rarity]}</span>;
}

const DISH_TOPPING: Record<RecipeId, string> = {
  marinara: 'var(--tomato)',
  margherita: 'var(--paper)',
  garlic_bread: 'var(--saffron)',
  pepperoni: '#a52a2a',
};

/** Round pizza (or garlic bread loaf) placeholder icon. */
export function DishIcon(props: { id: RecipeId; size?: number }) {
  const size = props.size ?? 44;
  const top = DISH_TOPPING[props.id];
  return (
    <span class="dish-icon" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      {props.id === 'garlic_bread' ? (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <rect x="3" y="9" width="26" height="14" rx="7" fill="var(--crust)" {...STROKE} />
          <path d="M10 12v8M16 12v8M22 12v8" stroke={top} stroke-width="3" stroke-linecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 32 32" width="100%" height="100%">
          <circle cx="16" cy="16" r="13" fill="var(--crust)" {...STROKE} />
          <circle cx="16" cy="16" r="9.5" fill="var(--tomato)" stroke="none" />
          {props.id === 'margherita' && (
            <>
              <circle cx="12" cy="13" r="3" fill={top} stroke="var(--ink)" stroke-width="1.5" />
              <circle cx="19.5" cy="18" r="3" fill={top} stroke="var(--ink)" stroke-width="1.5" />
              <circle cx="18" cy="11.5" r="1.8" fill="var(--basil)" />
            </>
          )}
          {props.id === 'pepperoni' && (
            <>
              <circle cx="12" cy="13" r="2.8" fill={top} stroke="var(--ink)" stroke-width="1.5" />
              <circle cx="20" cy="14" r="2.8" fill={top} stroke="var(--ink)" stroke-width="1.5" />
              <circle cx="15" cy="20" r="2.8" fill={top} stroke="var(--ink)" stroke-width="1.5" />
            </>
          )}
          {props.id === 'marinara' && (
            <path d="M11 14l2 1M18 12l2 1M15 20l2 1" stroke="var(--basil)" stroke-width="2" />
          )}
        </svg>
      )}
    </span>
  );
}

/** Coin glyph for "coins only" upgrades (same look as the HUD coin). */
export function CoinGlyph(props: { size?: number }) {
  const size = props.size ?? 34;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" class="coin-glyph">
      <circle cx="12" cy="12" r="10" fill="var(--saffron)" stroke="var(--ink)" stroke-width="3" />
      <path
        d="M12 7v10M9 10c0-2 6-2 6 0s-6 2-6 4 6 2 6 0"
        fill="none"
        stroke="var(--ink)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}
