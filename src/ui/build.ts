import { signal } from '@preact/signals';
import { FURNITURE, type FurnitureDefId, type Rot } from '../data/furniture';
import type { Game } from '../sim/game';
import {
  hasAdjacentTable,
  findFreeSpot,
  validateBuy,
  validatePlacement,
} from '../sim/systems/build';
import type { BuyResult } from '../sim/systems/build';
import { dispatch } from './store';

/** What the player is currently placing: a new purchase or an existing piece being moved. */
export type Placing =
  { kind: 'new'; defId: FurnitureDefId } | { kind: 'move'; id: string; defId: FurnitureDefId };

export interface Ghost {
  placing: Placing;
  x: number;
  y: number;
  rot: Rot;
  result: BuyResult;
  /** A chair with no table next to it: allowed, but guests will not use it. */
  orphanChair: boolean;
}

/** Build UI state (not game state): the view reads it to draw, the bars read it to show buttons. */
export const buildMode = signal(false);
export const ghost = signal<Ghost | null>(null);
export const shopOpen = signal(false);

let simRef: Game | null = null;

export function bindBuild(sim: Game): void {
  simRef = sim;
  sim.events.on('phaseChanged', (e) => {
    if (e.phase !== 'prep') exitBuild();
  });
  // Money changes the validity of a new purchase (e.g. debug top-up).
  sim.events.on('moneyChanged', () => refresh());
}

function evaluate(sim: Game, g: Omit<Ghost, 'result' | 'orphanChair'>): Ghost {
  const { placing, x, y, rot } = g;
  const state = sim.state;
  const result: BuyResult =
    placing.kind === 'new'
      ? validateBuy(state, placing.defId, x, y, rot)
      : state.clock.phase !== 'prep'
        ? { ok: false, reason: 'notPrep' }
        : validatePlacement(state, placing.defId, x, y, rot, placing.id);
  const others = state.furniture.filter((f) => placing.kind !== 'move' || f.id !== placing.id);
  const orphanChair = FURNITURE[placing.defId].kind === 'chair' && !hasAdjacentTable(others, x, y);
  return { ...g, result, orphanChair };
}

function refresh(): void {
  const g = ghost.peek();
  if (g && simRef) ghost.value = evaluate(simRef, g);
}

function setGhost(placing: Placing, x: number, y: number, rot: Rot): void {
  if (simRef) ghost.value = evaluate(simRef, { placing, x, y, rot });
}

export function enterBuild(): void {
  buildMode.value = true;
}

export function exitBuild(): void {
  buildMode.value = false;
  ghost.value = null;
  shopOpen.value = false;
}

/** Starts placing a new purchase at a free tile near the room centre. Money is spent on confirm. */
export function startPlacingNew(defId: FurnitureDefId): void {
  if (!simRef) return;
  const spot = findFreeSpot(simRef.state, defId) ?? { x: 4, y: 5 };
  shopOpen.value = false;
  buildMode.value = true;
  setGhost({ kind: 'new', defId }, spot.x, spot.y, 0);
}

/** Picks up an existing piece; its old position counts as free until confirmed. */
export function startMoving(id: string): void {
  const f = simRef?.state.furniture.find((o) => o.id === id);
  if (!f) return;
  setGhost({ kind: 'move', id, defId: f.defId }, f.x, f.y, f.rot);
}

export function moveGhostTo(x: number, y: number): void {
  const g = ghost.peek();
  if (g && (g.x !== x || g.y !== y)) setGhost(g.placing, x, y, g.rot);
}

export function rotateGhost(): void {
  const g = ghost.peek();
  if (g) setGhost(g.placing, g.x, g.y, g.rot === 0 ? 1 : 0);
}

export function cancelPlacing(): void {
  ghost.value = null;
}

/** Sends the command; on success the ghost is gone, on refusal the reason is shown. */
export function confirmPlacing(): void {
  const g = ghost.peek();
  if (!g || !simRef) return;
  const cmd =
    g.placing.kind === 'new'
      ? ({ type: 'buyAndPlace', defId: g.placing.defId, x: g.x, y: g.y, rot: g.rot } as const)
      : ({ type: 'moveFurniture', id: g.placing.id, x: g.x, y: g.y, rot: g.rot } as const);
  const res = dispatch(cmd);
  if (res.ok) ghost.value = null;
  else ghost.value = { ...g, result: res as BuyResult };
}
