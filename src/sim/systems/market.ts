import {
  GIFT_CHANCE,
  GIFT_MIN_HAPPINESS,
  GIFT_RARE_CHANCE,
  MARKET_PRICE,
  MARKET_RARE_CHANCE,
  MARKET_SLOTS,
} from '../../data/balance';
import {
  COMMON_INGREDIENTS,
  INGREDIENTS,
  RARE_INGREDIENTS,
  type IngredientId,
  type Rarity,
} from '../../data/ingredients';
import type { Emitter, GameEvents } from '../events';
import { rngInt, rngNext, rngPick } from '../rng';
import type { GameState } from '../state';
import type { DayPhase } from '../time';

export interface MarketOffer {
  ingredient: IngredientId;
  price: number;
  bought: boolean;
}

export interface MarketState {
  /** The day these offers were rolled for. */
  day: number;
  offers: MarketOffer[];
}

export type MarketReason = 'notNow' | 'unknownOffer' | 'alreadyBought' | 'notEnoughMoney';
export type MarketResult = { ok: true } | { ok: false; reason: MarketReason };

export function createInventory(): Record<IngredientId, number> {
  const out = {} as Record<IngredientId, number>;
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) out[id] = 0;
  return out;
}

function pickOfRarity(state: GameState, rarity: Rarity, avoid: readonly IngredientId[]) {
  const pool = (rarity === 'rare' ? RARE_INGREDIENTS : COMMON_INGREDIENTS).filter(
    (id) => !avoid.includes(id),
  );
  return rngPick(
    state,
    pool.length > 0 ? pool : rarity === 'rare' ? RARE_INGREDIENTS : COMMON_INGREDIENTS,
  );
}

/** Rolls the day's offers with the seeded RNG (distinct ingredients within one day). */
export function rollMarket(state: GameState, day: number): MarketState {
  const offers: MarketOffer[] = [];
  for (let i = 0; i < MARKET_SLOTS; i++) {
    const rarity: Rarity = rngNext(state) < MARKET_RARE_CHANCE ? 'rare' : 'common';
    const ingredient = pickOfRarity(
      state,
      rarity,
      offers.map((o) => o.ingredient),
    );
    const [min, max] = MARKET_PRICE[rarity];
    offers.push({ ingredient, price: rngInt(state, min, max), bought: false });
  }
  return { day, offers };
}

export function validateBuyOffer(
  view: { phase: DayPhase; money: number; market: MarketState },
  index: number,
): MarketResult {
  if (view.phase === 'night') return { ok: false, reason: 'notNow' };
  const offer = view.market.offers[index];
  if (!offer) return { ok: false, reason: 'unknownOffer' };
  if (offer.bought) return { ok: false, reason: 'alreadyBought' };
  if (view.money < offer.price) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true };
}

/** Adds one ingredient to the inventory and announces it. */
export function addIngredient(
  state: GameState,
  events: Emitter<GameEvents>,
  ingredient: IngredientId,
): void {
  state.inventory[ingredient]++;
  events.emit('inventoryChanged', { ingredient, count: state.inventory[ingredient] });
}

/**
 * A guest leaves very happy: small chance of a gift ingredient (rares likelier than in the
 * market). No random numbers are drawn below the happiness threshold.
 */
export function rollGift(
  state: GameState,
  events: Emitter<GameEvents>,
  guest: { id: string; name: string; happiness: number },
): void {
  if (guest.happiness < GIFT_MIN_HAPPINESS) return;
  if (rngNext(state) >= GIFT_CHANCE) return;
  const rarity: Rarity = rngNext(state) < GIFT_RARE_CHANCE ? 'rare' : 'common';
  const ingredient = rngPick(state, rarity === 'rare' ? RARE_INGREDIENTS : COMMON_INGREDIENTS);
  addIngredient(state, events, ingredient);
  events.emit('giftReceived', { guestId: guest.id, guestName: guest.name, ingredient });
}
