import { SELL_REFUND_RATE } from '../../data/balance';
import {
  FURNITURE,
  MAX_FURNITURE_LEVEL,
  type FurnitureKind,
  type FurnitureReason,
} from '../../data/furniture';
import { footprintTiles, type Furniture } from '../grid';
import type { GameState } from '../state';
import { isInUse, reachabilityOk } from './build';

/** Value of a per-level array at the piece's level (0 / fallback when it has none). */
function atLevel(arr: readonly number[] | undefined, f: Furniture, fallback = 0): number {
  return arr?.[f.level - 1] ?? fallback;
}

export function appealOf(f: Furniture): number {
  return atLevel(FURNITURE[f.defId].appeal, f);
}

export function comfortOf(f: Furniture): number {
  return atLevel(FURNITURE[f.defId].comfort, f);
}

/** Work-time multiplier of the piece at its level (1 = normal; lower is faster). */
export function speedOf(f: Furniture): number {
  return atLevel(FURNITURE[f.defId].speed, f, 1);
}

/** Speed of the first piece of a kind: the oven and pass the staff actually use. */
export function stationSpeed(state: Pick<GameState, 'furniture'>, kind: FurnitureKind): number {
  const f = state.furniture.find((o) => FURNITURE[o.defId].kind === kind);
  return f ? speedOf(f) : 1;
}

/** Coins to take the piece one level up, or null at the top level. */
export function upgradeCostOf(f: Furniture): number | null {
  if (f.level >= MAX_FURNITURE_LEVEL) return null;
  return FURNITURE[f.defId].levelUpCost[f.level - 1] ?? null;
}

/** Coins already spent on the piece's upgrades. */
export function upgradeSpent(f: Furniture): number {
  return FURNITURE[f.defId].levelUpCost.slice(0, f.level - 1).reduce((a, b) => a + b, 0);
}

/** Refund when selling: a share of the price plus the same share of the upgrade coins. */
export function sellRefund(f: Furniture): number {
  return Math.floor((FURNITURE[f.defId].price + upgradeSpent(f)) * SELL_REFUND_RATE);
}

/**
 * Aura points a chair gets: per reason only the best single source counts (a second piano does
 * not add to the first; D-039). Different reasons add up.
 */
export function auraPoints(
  furniture: readonly Furniture[],
  chair: { x: number; y: number },
  reason: FurnitureReason,
): number {
  let best = 0;
  for (const f of furniture) {
    const aura = FURNITURE[f.defId].aura;
    if (!aura || aura.reason !== reason) continue;
    let dist = Infinity;
    for (const t of footprintTiles(f.defId, f.x, f.y, f.rot)) {
      dist = Math.min(dist, Math.max(Math.abs(t.x - chair.x), Math.abs(t.y - chair.y)));
    }
    if (dist <= aura.radius) best = Math.max(best, atLevel(aura.points, f));
  }
  return best;
}

export type UpgradeReason = 'notNow' | 'unknownFurniture' | 'maxLevel' | 'notEnoughMoney';
export type UpgradeResult = { ok: true; cost: number } | { ok: false; reason: UpgradeReason };
export type SellReason = 'notNow' | 'unknownFurniture' | 'inUse' | 'lastRequired' | 'blocksWay';
export type SellResult = { ok: true; refund: number } | { ok: false; reason: SellReason };

export function validateUpgradeFurniture(state: GameState, id: string): UpgradeResult {
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  const piece = state.furniture.find((f) => f.id === id);
  if (!piece) return { ok: false, reason: 'unknownFurniture' };
  const cost = upgradeCostOf(piece);
  if (cost === null) return { ok: false, reason: 'maxLevel' };
  if (state.money < cost) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true, cost };
}

/** Not in use, not the last oven / pass, and the room stays walkable (same check as placing). */
export function validateSell(state: GameState, id: string): SellResult {
  if (state.clock.phase === 'night') return { ok: false, reason: 'notNow' };
  const piece = state.furniture.find((f) => f.id === id);
  if (!piece) return { ok: false, reason: 'unknownFurniture' };
  if (isInUse(state, piece)) return { ok: false, reason: 'inUse' };
  const kind = FURNITURE[piece.defId].kind;
  if (
    (kind === 'oven' || kind === 'pass') &&
    !state.furniture.some((o) => o.id !== id && FURNITURE[o.defId].kind === kind)
  ) {
    return { ok: false, reason: 'lastRequired' };
  }
  const rest = state.furniture.filter((f) => f.id !== id);
  if (!reachabilityOk(state, rest)) return { ok: false, reason: 'blocksWay' };
  return { ok: true, refund: sellRefund(piece) };
}
