import { LEDGER_NOTABLE_TIP } from '../data/balance';
import { RECIPE_IDS, type RecipeId } from '../data/recipes';

export type LedgerKind =
  'dish' | 'tip' | 'ingredients' | 'furniture' | 'market' | 'upgrade' | 'moment';

/**
 * One line of the day's money ledger (D-033). `amount` is signed (+ income, - spending).
 * `count` > 1 means a running total of many small events of the same kind (label is ''),
 * otherwise the entry is a single event and `label` names it (furniture/ingredient/recipe id,
 * `recipeId:level` for upgrades, or the guest's name for a notable tip).
 */
export interface LedgerEntry {
  tick: number;
  kind: LedgerKind;
  amount: number;
  label: string;
  count: number;
}

/**
 * Bounding rule: dish, tip and ingredient events are folded into ONE aggregate entry per kind
 * (summed amount + count); only the day's single biggest tip of at least NOTABLE_TIP is split
 * out as its own entry. Furniture, market and upgrade purchases are kept individually (the player
 * triggers them, and money limits how many fit in a day). The ledger resets every day, so it is
 * bounded by 3 aggregates + 1 notable tip + the day's purchases.
 */
export interface Ledger {
  entries: LedgerEntry[];
}

export interface DayStats {
  ledger: Ledger;
  /** Money received from guests (dish prices plus tips). */
  income: number;
  tips: number;
  fameGained: number;
  ingredientCosts: number;
  guestsServed: number;
  guestsLeftNoSeat: number;
  /** Ingredient gifts received from guests today. */
  gifts: number;
  /** Dishes sold (paid) today, per recipe. */
  ordersByRecipe: Partial<Record<RecipeId, number>>;
}

export function createDayStats(): DayStats {
  return {
    ledger: { entries: [] },
    income: 0,
    tips: 0,
    fameGained: 0,
    ingredientCosts: 0,
    guestsServed: 0,
    guestsLeftNoSeat: 0,
    gifts: 0,
    ordersByRecipe: {},
  };
}

export function profitOf(stats: DayStats): number {
  return stats.income - stats.ingredientCosts;
}

/** Most sold recipe of the day (first in recipe order on ties), or null when nothing sold. */
export function bestSeller(stats: DayStats): RecipeId | null {
  let best: RecipeId | null = null;
  let bestN = 0;
  for (const id of RECIPE_IDS) {
    const n = stats.ordersByRecipe[id] ?? 0;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

function aggregate(ledger: Ledger, kind: LedgerKind): LedgerEntry | undefined {
  return ledger.entries.find((e) => e.kind === kind && e.label === '');
}

/** Adds money to the ledger following the bounding rule above. Pure bookkeeping, no RNG. */
export function recordLedger(
  stats: DayStats,
  tick: number,
  kind: LedgerKind,
  amount: number,
  label = '',
): void {
  const { ledger } = stats;
  if (kind === 'furniture' || kind === 'market' || kind === 'upgrade' || kind === 'moment') {
    ledger.entries.push({ tick, kind, amount, label, count: 1 });
    return;
  }
  let agg = aggregate(ledger, kind);
  if (!agg) {
    agg = { tick, kind, amount: 0, label: '', count: 0 };
    ledger.entries.push(agg);
  }
  if (kind === 'tip' && amount >= LEDGER_NOTABLE_TIP) {
    const prev = ledger.entries.find((e) => e.kind === 'tip' && e.label !== '');
    if (!prev || amount > prev.amount) {
      // The new tip becomes the notable one; the old notable one folds back into the aggregate.
      if (prev) {
        agg.amount += prev.amount;
        agg.count += 1;
        ledger.entries.splice(ledger.entries.indexOf(prev), 1);
      }
      ledger.entries.push({ tick, kind, amount, label, count: 1 });
      return;
    }
  }
  agg.amount += amount;
  agg.count++;
  agg.tick = tick;
}

/** Sum of all entries of a kind (all kinds when omitted). */
export function ledgerTotal(ledger: Ledger, kind?: LedgerKind): number {
  let sum = 0;
  for (const e of ledger.entries) if (!kind || e.kind === kind) sum += e.amount;
  return sum;
}
