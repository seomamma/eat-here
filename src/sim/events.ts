/** Tiny typed event emitter (Sim -> View/UI). Handlers run synchronously in registration order. */
export class Emitter<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  /** Subscribes; returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) (h as (p: Events[K]) => void)(payload);
  }
}

export type GuestEmote = 'angry' | 'hand' | 'tasty' | 'love' | 'slow' | 'heart';
export type GuestLeaveReason = 'done' | 'noSeat' | 'closed';

import type { RoomGrowth } from '../data/expansion';
import type { FurnitureDefId, Rot } from '../data/furniture';
import type { Room } from '../data/layout';
import type { IngredientId } from '../data/ingredients';
import type { MomentCard, MomentReward } from '../data/moments';
import type { RegularId } from '../data/regulars';
import type { RecipeId } from '../data/recipes';
import type { DayStats } from './dayStats';
import type { DayPhase } from './time';

/** Events the sim emits (Sim -> View/UI). */
export interface GameEvents {
  walkerArrived: { id: string };
  guestArrived: { guestId: string };
  guestSeated: { guestId: string; seatId: string };
  guestEmote: { guestId: string; emote: GuestEmote };
  /** `amount` = `price` + `tip` (what was added to the money); `fame` = fame the guest gave. */
  paid: {
    guestId: string;
    price: number;
    tip: number;
    amount: number;
    fame: number;
    x: number;
    y: number;
  };
  fameChanged: { fame: number; gained: number; rank: number };
  rankUp: {
    rank: number;
    name: string;
    unlocks: string[];
    reward: IngredientId | null;
    /** Room growth that came with the rank (M12b), or null. */
    space: RoomGrowth | null;
  };
  /** The room grew (part of a rank-up): `added` is what was actually unlocked. */
  roomExpanded: { rank: number; added: RoomGrowth; room: Room };
  /** The ingredient inventory changed (market buy, gift, reward, upgrade). */
  inventoryChanged: { ingredient: IngredientId; count: number };
  /** New market offers were rolled (start of a day). */
  marketRefreshed: { day: number };
  recipeLeveledUp: { recipeId: RecipeId; level: number };
  /** A very happy guest left an ingredient. */
  giftReceived: { guestId: string; guestName: string; ingredient: IngredientId };
  /** A one-off moment fired (rewards are already applied); the UI shows its card. */
  momentTriggered: { id: string; card: MomentCard; reward: MomentReward | null };
  /** A regular showed up for their visit. */
  regularArrived: { regularId: RegularId; guestId: string };
  /** A regular gained a friendship heart. */
  heartGained: { regularId: RegularId; guestId: string; hearts: number };
  guestLeft: { guestId: string; reason: GuestLeaveReason };
  moneyChanged: { money: number };
  /** A new piece was bought and placed. */
  furniturePlaced: { id: string; defId: FurnitureDefId; x: number; y: number; rot: Rot };
  furnitureMoved: { id: string; x: number; y: number; rot: Rot };
  furnitureLeveledUp: { id: string; defId: FurnitureDefId; level: number };
  /** A piece was sold; `refund` coins were paid out. */
  furnitureSold: { id: string; defId: FurnitureDefId; refund: number };
  /** A paint stroke was applied (tiles or wall segments), `cost` coins paid. */
  surfacePainted: { target: 'floor' | 'wall'; count: number; cost: number };
  /** A guest finished a vending machine or toilet visit. */
  errandDone: { guestId: string; kind: 'vending' | 'toilet'; coins: number };
  /** The waiter finished taking the order; a cook job now exists. */
  orderTaken: { orderId: string; guestId: string; recipeId: string };
  /** Cooking started and ingredients were paid for. */
  ingredientsBought: { orderId: string; amount: number };
  /** The dish is on the pass. */
  dishReady: { orderId: string };
  /** The dish reached the guest. */
  dishServed: { orderId: string; guestId: string };
  /** The order was dropped because its guest left mid-flow. */
  orderDiscarded: { orderId: string; guestId: string };
  /** The clock's displayed minute or the phase changed. */
  clockChanged: { day: number; minuteOfDay: number; phase: DayPhase };
  phaseChanged: { day: number; phase: DayPhase };
  /** A new day began (after the night transition) at opening time. */
  dayStarted: { day: number };
  /** The restaurant is closed and empty; `stats` are the finished day's numbers. */
  dayEnded: { day: number; stats: DayStats };
}
