import { signal } from '@preact/signals';
import { FURNITURE, type FurnitureDefId, type Rot } from '../data/furniture';
import type { Game } from '../sim/game';
import {
  autoFaceRot,
  chairFacesTable,
  findFreeSpot,
  validateBuy,
  validateMove,
} from '../sim/systems/build';
import type { BuyResult, MoveResult } from '../sim/systems/build';
import { dispatch } from './store';
import { settingsOpen } from './settings';

/** What the player is currently placing: a new purchase or an existing piece being moved. */
export type Placing =
  { kind: 'new'; defId: FurnitureDefId } | { kind: 'move'; id: string; defId: FurnitureDefId };

export interface Ghost {
  placing: Placing;
  x: number;
  y: number;
  rot: Rot;
  result: BuyResult;
  /** A chair facing no table: allowed, but guests will not use it. */
  orphanChair: boolean;
  /** True once the player rotated a new piece by hand (stops auto-facing). */
  manualRot: boolean;
}

/** Build UI state (not game state): the view reads it to draw, the bars read it to show buttons. */
export const buildMode = signal(false);
export const ghost = signal<Ghost | null>(null);
export const shopOpen = signal(false);
export const shopTab = signal<'furniture' | 'market'>('furniture');
export const recipesOpen = signal(false);
export const guestsOpen = signal(false);
/** The Menu hub (grid of shortcut cards) and the money breakdown popover. */
export const menuOpen = signal(false);
export const todayOpen = signal(false);

/** Screen rectangle (CSS px, whole numbers) of the ghost; written by the view, null when none. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export const ghostRect = signal<ScreenRect | null>(null);

/** Opens a panel from the Menu: closes the hub first. */
export type MenuTarget = 'shop' | 'market' | 'recipes' | 'guests' | 'build' | 'settings';
export function openFromMenu(target: MenuTarget): void {
  menuOpen.value = false;
  if (target === 'shop') openShop('furniture');
  else if (target === 'market') openShop('market');
  else if (target === 'recipes') openRecipes();
  else if (target === 'guests') openGuests();
  else if (target === 'settings') settingsOpen.value = true;
  else enterBuild();
}

/** Shop and recipe book share one slot on screen: opening one closes the other. */
export function openShop(tab: 'furniture' | 'market' = shopTab.peek()): void {
  shopTab.value = tab;
  recipesOpen.value = false;
  guestsOpen.value = false;
  shopOpen.value = true;
}

export function openRecipes(): void {
  shopOpen.value = false;
  guestsOpen.value = false;
  recipesOpen.value = true;
}

export function openGuests(): void {
  shopOpen.value = false;
  recipesOpen.value = false;
  guestsOpen.value = true;
}

/** Pause reason held while build mode is on (placing or moving): time stands still. */
const BUILD_PAUSE = 'build';

let simRef: Game | null = null;

export function bindBuild(sim: Game): void {
  simRef = sim;
  // Night and the report take over the screen: leave build mode (and let time run again).
  sim.events.on('phaseChanged', (e) => {
    if (e.phase === 'night' || e.phase === 'report') {
      exitBuild();
      menuOpen.value = false;
      guestsOpen.value = false;
      todayOpen.value = false;
      settingsOpen.value = false;
    }
  });
  buildMode.subscribe((on) => {
    if (on) sim.pause(BUILD_PAUSE);
    else sim.resume(BUILD_PAUSE);
  });
  // Money changes the validity of a new purchase (e.g. debug top-up).
  sim.events.on('moneyChanged', () => refresh());
}

function evaluate(sim: Game, g: Omit<Ghost, 'result' | 'orphanChair'>): Ghost {
  const { placing, x, y, rot } = g;
  const state = sim.state;
  const result: BuyResult | MoveResult =
    placing.kind === 'new'
      ? validateBuy(state, placing.defId, x, y, rot)
      : validateMove(state, placing.id, x, y, rot);
  const others = state.furniture.filter((f) => placing.kind !== 'move' || f.id !== placing.id);
  const orphanChair =
    FURNITURE[placing.defId].kind === 'chair' && !chairFacesTable(others, x, y, rot);
  return { ...g, result: result as BuyResult, orphanChair };
}

function refresh(): void {
  const g = ghost.peek();
  if (g && simRef) ghost.value = evaluate(simRef, g);
}

function setGhost(placing: Placing, x: number, y: number, rot: Rot, manualRot = false): void {
  if (simRef) ghost.value = evaluate(simRef, { placing, x, y, rot, manualRot });
}

/** Rotation a new chair gets at a tile: faces the adjacent table unless the player chose. */
function rotAt(placing: Placing, x: number, y: number, rot: Rot, manualRot: boolean): Rot {
  if (manualRot || placing.kind !== 'new' || FURNITURE[placing.defId].kind !== 'chair') return rot;
  return simRef ? autoFaceRot(simRef.state.furniture, x, y) : rot;
}

export function enterBuild(): void {
  buildMode.value = true;
}

export function exitBuild(): void {
  buildMode.value = false;
  ghost.value = null;
  ghostRect.value = null;
  shopOpen.value = false;
  recipesOpen.value = false;
  guestsOpen.value = false;
}

/** Starts placing a new purchase at a free tile near the room centre. Money is spent on confirm. */
export function startPlacingNew(defId: FurnitureDefId): void {
  if (!simRef) return;
  const spot = findFreeSpot(simRef.state, defId) ?? { x: 4, y: 5 };
  shopOpen.value = false;
  recipesOpen.value = false;
  buildMode.value = true;
  const placing: Placing = { kind: 'new', defId };
  setGhost(placing, spot.x, spot.y, rotAt(placing, spot.x, spot.y, 0, false));
}

/** Picks up an existing piece; its old position counts as free until confirmed. */
export function startMoving(id: string): void {
  const f = simRef?.state.furniture.find((o) => o.id === id);
  if (!f) return;
  setGhost({ kind: 'move', id, defId: f.defId }, f.x, f.y, f.rot);
}

export function moveGhostTo(x: number, y: number): void {
  const g = ghost.peek();
  if (g && (g.x !== x || g.y !== y)) {
    setGhost(g.placing, x, y, rotAt(g.placing, x, y, g.rot, g.manualRot), g.manualRot);
  }
}

export function rotateGhost(): void {
  const g = ghost.peek();
  if (g) setGhost(g.placing, g.x, g.y, ((g.rot + 1) % 4) as Rot, true);
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
