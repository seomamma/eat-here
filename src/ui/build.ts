import { signal } from '@preact/signals';
import {
  FURNITURE,
  type FurnitureCategory,
  type FurnitureDefId,
  type Rot,
} from '../data/furniture';
import type { Game } from '../sim/game';
import {
  autoFaceRot,
  chairFacesTable,
  findFreeSpot,
  validateBuy,
  validateMove,
} from '../sim/systems/build';
import type { BuyResult, MoveResult } from '../sim/systems/build';
import { dispatch, pushToast } from './store';
import { STRINGS } from '../data/strings';
import type { FloorStyleId, WallStyleId } from '../data/surfaces';
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
/** Category chip of the shop's Furniture tab. */
export const shopCategory = signal<FurnitureCategory>('seating');
/** Placed piece whose item card is open in build mode, and a counter that refreshes the card. */
export const selectedPiece = signal<string | null>(null);
export const pieceRev = signal(0);

/** Paint mode (build mode with a style in hand): the style being painted and the current stroke. */
export type PaintTarget = { kind: 'floor'; id: FloorStyleId } | { kind: 'wall'; id: WallStyleId };
export interface PaintStroke {
  tiles: { x: number; y: number }[];
  segments: string[];
}
export const paintStyle = signal<PaintTarget | null>(null);
export const paintStroke = signal<PaintStroke | null>(null);
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
  for (const ev of ['furnitureLeveledUp', 'furnitureMoved', 'furniturePlaced'] as const) {
    sim.events.on(ev, () => {
      pieceRev.value++;
    });
  }
  sim.events.on('furnitureSold', (e) => {
    if (selectedPiece.peek() === e.id) selectedPiece.value = null;
    pieceRev.value++;
  });
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
  selectedPiece.value = null;
  paintStyle.value = null;
  paintStroke.value = null;
  ghostRect.value = null;
  shopOpen.value = false;
  recipesOpen.value = false;
  guestsOpen.value = false;
}

/** Starts placing a new purchase at a free tile near the room centre. Money is spent on confirm. */
export function startPlacingNew(defId: FurnitureDefId): void {
  if (!simRef) return;
  const spot = findFreeSpot(simRef.state, defId) ?? { x: 4, y: 5 };
  selectedPiece.value = null;
  paintStyle.value = null;
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
  selectedPiece.value = null;
  setGhost({ kind: 'move', id, defId: f.defId }, f.x, f.y, f.rot);
}

/** Build mode tap on a placed piece (or empty floor = null): opens or closes its item card. */
export function selectPiece(id: string | null): void {
  if (ghost.peek() || paintStyle.peek()) return;
  selectedPiece.value = id;
}

export function upgradeSelected(): void {
  const id = selectedPiece.peek();
  if (!id) return;
  const res = dispatch({ type: 'upgradeFurniture', id });
  if (!res.ok) pushToast({ kind: 'notice', text: STRINGS.build.reasons[res.reason] ?? res.reason });
}

/** Sells the selected piece; the refusal reason (e.g. in use) shows as a notice. */
export function sellSelected(): void {
  const id = selectedPiece.peek();
  if (!id) return;
  const res = dispatch({ type: 'sellFurniture', id });
  if (res.ok) selectedPiece.value = null;
  else pushToast({ kind: 'notice', text: STRINGS.build.reasons[res.reason] ?? res.reason });
}

/** Floors & Walls entry of the shop: build mode with a style in hand (time stands still). */
export function startPaintMode(): void {
  ghost.value = null;
  selectedPiece.value = null;
  shopOpen.value = false;
  recipesOpen.value = false;
  buildMode.value = true;
  paintStyle.value = paintStyle.peek() ?? { kind: 'floor', id: 'wood' };
}

export function setPaintStyle(target: PaintTarget): void {
  paintStyle.value = target;
  paintStroke.value = null;
}

/** A paint target under the finger: a floor tile or a wall segment. */
export type PaintHit = { tile: { x: number; y: number } } | { segment: string };

/** Adds the hit to the stroke if it matches the style kind; true when it did. */
export function paintAt(hit: PaintHit | null): boolean {
  const style = paintStyle.peek();
  if (!style || !hit) return false;
  const cur = paintStroke.peek() ?? { tiles: [], segments: [] };
  if (style.kind === 'floor' && 'tile' in hit) {
    if (cur.tiles.some((t) => t.x === hit.tile.x && t.y === hit.tile.y)) return true;
    paintStroke.value = { ...cur, tiles: [...cur.tiles, hit.tile] };
    return true;
  }
  if (style.kind === 'wall' && 'segment' in hit) {
    if (cur.segments.includes(hit.segment)) return true;
    paintStroke.value = { ...cur, segments: [...cur.segments, hit.segment] };
    return true;
  }
  return false;
}

/** The finger lifted: one paint command for the whole stroke; a refusal shows as a notice. */
export function endPaintStroke(): void {
  const stroke = paintStroke.peek();
  const style = paintStyle.peek();
  paintStroke.value = null;
  if (!stroke || !style) return;
  const res =
    style.kind === 'floor'
      ? dispatch({ type: 'paintFloor', tiles: stroke.tiles, style: style.id })
      : dispatch({ type: 'paintWall', segments: stroke.segments, style: style.id });
  if (!res.ok) {
    pushToast({
      kind: 'notice',
      text:
        STRINGS.build.paint.reasons[res.reason] ?? STRINGS.build.reasons[res.reason] ?? res.reason,
    });
  }
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
