import { FURNITURE, MAX_FURNITURE_LEVEL, type FurnitureDefId } from '../data/furniture';
import { STRINGS } from '../data/strings';
import type { GameState } from '../sim/state';
import {
  upgradeCostOf,
  validateSell,
  validateUpgradeFurniture,
  sellRefund,
} from '../sim/systems/facilities';

const C = STRINGS.build.card;

/** Share of time a station saves at a level, in whole percent (Lv.1 = 0). */
function savedPct(speed: readonly number[] | undefined, level: number): number {
  return Math.round((1 - (speed?.[level - 1] ?? 1)) * 100);
}

/**
 * What a piece does at its level and, when `withNext`, what the next level gives
 * ("Appeal 8 → 12", "Bakes 10 % faster"). One line per effect.
 */
export function effectLines(defId: FurnitureDefId, level: number, withNext = true): string[] {
  const def = FURNITURE[defId];
  const next = withNext && level < MAX_FURNITURE_LEVEL ? level + 1 : null;
  const at = (arr: readonly number[] | undefined, lv: number) => arr?.[lv - 1] ?? 0;
  const pair = (arr: readonly number[] | undefined) =>
    [at(arr, level), next ? at(arr, next) : null] as const;
  const lines: string[] = [];
  if (def.kind === 'decor') lines.push(C.appeal(...pair(def.appeal)));
  if (def.comfort) lines.push(C.comfort(...pair(def.comfort)));
  if (def.aura) lines.push(C.music(...pair(def.aura.points), def.aura.radius));
  if (def.kind === 'toilet' && def.interaction)
    lines.push(C.toilet(...pair(def.interaction.points)));
  if (def.kind === 'vending' && def.interaction)
    lines.push(C.vending(...pair(def.interaction.coins)));
  if (def.speed) {
    const cur = savedPct(def.speed, level);
    const nxt = next ? savedPct(def.speed, next) : null;
    lines.push((def.kind === 'oven' ? C.bakes : C.plates)(cur, nxt));
  }
  return lines;
}

/** Everything the item card shows about one placed piece (read-only snapshot). */
export interface PieceInfo {
  id: string;
  defId: FurnitureDefId;
  name: string;
  level: number;
  lines: string[];
  /** Coins for the next level, null at the top. */
  upgradeCost: number | null;
  canUpgrade: boolean;
  refund: number;
  /** Null when selling is possible, else the refusal reason. */
  sellBlocked: string | null;
}

export function pieceInfo(state: GameState, id: string): PieceInfo | null {
  const f = state.furniture.find((o) => o.id === id);
  if (!f) return null;
  const sell = validateSell(state, id);
  return {
    id,
    defId: f.defId,
    name: FURNITURE[f.defId].name,
    level: f.level,
    lines: effectLines(f.defId, f.level),
    upgradeCost: upgradeCostOf(f),
    canUpgrade: validateUpgradeFurniture(state, id).ok,
    refund: sellRefund(f),
    sellBlocked: sell.ok ? null : sell.reason,
  };
}
