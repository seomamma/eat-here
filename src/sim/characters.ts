import { DEBUG_WALKER_SPEED, TICK_MS } from '../data/balance';
import type { GuestTypeId } from '../data/guests';
import type { StaffRole } from '../data/staff';
import type { RecipeId } from '../data/recipes';
import type { GuestLeaveReason } from './events';
import type { HappinessEntry } from './systems/happiness';
import type { TilePos } from './pathfinding';

/**
 * Screen-facing of a character in the isometric view. +x on the grid goes down-right on screen,
 * +y down-left, -x up-left, -y up-right.
 */
export type IsoDir = 'dr' | 'dl' | 'ur' | 'ul';

export interface CharacterBase {
  id: string;
  /** Position in tile units; integer values are tile centres. Only axis-aligned movement. */
  x: number;
  y: number;
  /** Position at the start of the latest tick (render interpolates prev -> current). */
  prevX: number;
  prevY: number;
  /** Tiles still to visit, in order. Empty = standing still. */
  path: TilePos[];
  dir: IsoDir;
}

export interface DebugWalker extends CharacterBase {
  kind: 'debug';
}

/** Guest state machine (GAME_DESIGN §4). `gone` is transient: such guests are removed at once. */
export type GuestPhase =
  | 'arriving'
  | 'waitingForSeat'
  | 'walkingToSeat'
  | 'browsing'
  | 'wantsToOrder'
  | 'waitingForFood'
  | 'eating'
  | 'paying'
  | 'leaving'
  | 'gone';

export interface Guest extends CharacterBase {
  kind: 'guest';
  typeId: GuestTypeId;
  /** Palette variant index (0-based, below the type's `variants`). */
  variant: number;
  phase: GuestPhase;
  /** Ticks left in the current timed phase (patience, browsing, eating, paying). */
  timer: number;
  /** Claimed chair (furniture id) or null. The claim is what prevents double booking. */
  seatId: string | null;
  /** Spot near the door this guest waits at, or null. */
  waitSpot: TilePos | null;
  recipeId: RecipeId | null;
  leaveReason: GuestLeaveReason | null;
  /** Cosmetic first name (seeded pick at spawn). */
  name: string;
  /** Happiness meter 0..100 (GAME_DESIGN §4). */
  happiness: number;
  /** What filled the meter, in order (shown on the info card). */
  happinessLog: HappinessEntry[];
  /** Tick the current timed step began (arrival, hand raised, order taken). */
  stepTick: number;
  /** True once the "slow" emote was shown for the current step. */
  slowShown: boolean;
}

export type StaffPhase = 'idle' | 'walkingToJob' | 'working';
export type StaffAction = 'takeOrder' | 'cook' | 'placeDish' | 'pickUpDish' | 'serveDish';

/** Chef / waiter. The job stage is a plain string so the state stays serializable. */
export interface Staff extends CharacterBase {
  kind: 'staff';
  role: StaffRole;
  level: number;
  xp: number;
  phase: StaffPhase;
  jobId: string | null;
  /** Step within the current job (see systems/staff.ts). */
  stage: string;
  /** Tile the staff is walking to for the current stage; null = not planned yet. */
  target: TilePos | null;
  /** Current action while `working`, else null. */
  action: StaffAction | null;
  /** Ticks left of the current action. */
  timer: number;
  /** Dish in hands (view draws it), or null. */
  carrying: RecipeId | null;
  /** Idle spot the staff returns to. */
  home: TilePos;
}

export type Character = DebugWalker | Guest | Staff;

export function isGuest(c: Character): c is Guest {
  return c.kind === 'guest';
}

const TICK_S = TICK_MS / 1000;

export function isStaff(c: Character): c is Staff {
  return c.kind === 'staff';
}

export function dirFromStep(dx: number, dy: number, fallback: IsoDir): IsoDir {
  if (dx > 0) return 'dr';
  if (dx < 0) return 'ul';
  if (dy > 0) return 'dl';
  if (dy < 0) return 'ur';
  return fallback;
}

/** Advances one character by one tick along its path. Returns true when it arrived this tick. */
export function stepCharacter(c: CharacterBase, speed: number = DEBUG_WALKER_SPEED): boolean {
  c.prevX = c.x;
  c.prevY = c.y;
  if (c.path.length === 0) return false;
  let dist = speed * TICK_S;
  while (dist > 0 && c.path.length > 0) {
    const target = c.path[0] as TilePos;
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d > 0) c.dir = dirFromStep(dx, dy, c.dir);
    if (d <= dist) {
      c.x = target.x;
      c.y = target.y;
      dist -= d;
      c.path.shift();
    } else {
      c.x += Math.sign(dx) * dist;
      c.y += Math.sign(dy) * dist;
      dist = 0;
    }
  }
  return c.path.length === 0;
}
