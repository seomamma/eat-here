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

export type GuestEmote = 'angry' | 'hand' | 'tasty' | 'love' | 'slow';
export type GuestLeaveReason = 'done' | 'noSeat' | 'closed';

import type { FurnitureDefId, Rot } from '../data/furniture';
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
  rankUp: { rank: number; name: string; unlocks: string[] };
  guestLeft: { guestId: string; reason: GuestLeaveReason };
  moneyChanged: { money: number };
  /** A new piece was bought and placed. */
  furniturePlaced: { id: string; defId: FurnitureDefId; x: number; y: number; rot: Rot };
  furnitureMoved: { id: string; x: number; y: number; rot: Rot };
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
  /** The restaurant is closed and empty; `stats` are the finished day's numbers. */
  dayEnded: { day: number; stats: DayStats };
}
