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

export type GuestEmote = 'angry' | 'happy' | 'hand';
export type GuestLeaveReason = 'done' | 'noSeat' | 'closed';

import type { DayStats } from './dayStats';
import type { DayPhase } from './time';

/** Events the sim emits (Sim -> View/UI). */
export interface GameEvents {
  walkerArrived: { id: string };
  guestArrived: { guestId: string };
  guestSeated: { guestId: string; seatId: string };
  guestEmote: { guestId: string; emote: GuestEmote };
  paid: { guestId: string; amount: number; x: number; y: number };
  guestLeft: { guestId: string; reason: GuestLeaveReason };
  moneyChanged: { money: number };
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
