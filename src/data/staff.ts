/** Staff roles (GAME_DESIGN §5). Stats are fixed for now; `level`/`xp` on the state allow growth later. */

export type StaffRole = 'chef' | 'waiter';
export type JobKind = 'takeOrder' | 'cook' | 'deliver';

/** Multipliers around 1.0: higher = faster / better. */
export interface StaffStats {
  /** Walking speed multiplier. */
  speed: number;
  /** Divides cook time. */
  cooking: number;
  /** Divides take-order / serve / pick-up durations. */
  service: number;
}

/** Placeholder colours for the view (hex), shirt = [dark, mid, light]. */
export interface StaffPalette {
  shirt: readonly [string, string, string];
  apron: string;
  hair: string;
}

export interface StaffDef {
  name: string;
  /** Base walking speed in tiles per second. */
  walkSpeed: number;
  stats: StaffStats;
  /** Job kinds this role may take. */
  jobKinds: readonly JobKind[];
  palette: StaffPalette;
}

export const STAFF = {
  chef: {
    name: 'Chef',
    walkSpeed: 2.5,
    stats: { speed: 1, cooking: 1, service: 1 },
    jobKinds: ['cook'],
    palette: { shirt: ['#C7B08A', '#FFFFFF', '#F3E6CF'], apron: '#F3E6CF', hair: '#5C3A21' },
  },
  waiter: {
    name: 'Waiter',
    walkSpeed: 2.5,
    stats: { speed: 1, cooking: 1, service: 1 },
    jobKinds: ['takeOrder', 'deliver'],
    palette: { shirt: ['#C7B08A', '#F3E6CF', '#FFFFFF'], apron: '#2F3F5C', hair: '#2B1D16' },
  },
} satisfies Record<string, StaffDef>;

/** Stats of a role (fixed for now; becomes a function of `level` later). */
export function staffStats(role: StaffRole): StaffStats {
  return STAFF[role].stats;
}

/** Base durations of staff actions, in seconds (divided by the `service` stat). */
export const STAFF_ACTION_SEC = {
  takeOrder: 2.5,
  placeDish: 0.8,
  pickUpDish: 0.8,
  serveDish: 1.2,
} as const;
