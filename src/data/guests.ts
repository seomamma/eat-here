/** Guest types. MVP ships one type ("Local") with palette variants (GAME_DESIGN §4). */

export interface GuestTypeDef {
  name: string;
  /** Walking speed in tiles per second. */
  walkSpeed: number;
  /** How long a guest waits for a free seat before giving up, in seconds. */
  seatPatienceSec: number;
  /** Time spent browsing the menu once seated [min, max], in seconds. */
  browseSec: readonly [number, number];
  /** Time spent eating [min, max], in seconds. */
  eatSec: readonly [number, number];
  /** Number of palette variants (view picks the colours). */
  variants: number;
}

export const GUEST_TYPES = {
  local: {
    name: 'Local',
    walkSpeed: 2,
    seatPatienceSec: 30,
    browseSec: [2, 5],
    eatSec: [6, 11],
    variants: 4,
  },
} satisfies Record<string, GuestTypeDef>;

export type GuestTypeId = keyof typeof GUEST_TYPES;

/** First names handed out at spawn (seeded pick); purely cosmetic. */
export const GUEST_NAMES: readonly string[] = [
  'Anna',
  'Marco',
  'Lena',
  'Tom',
  'Sofia',
  'Ben',
  'Mia',
  'Luca',
  'Nora',
  'Leo',
  'Ida',
  'Sam',
  'Elsa',
  'Theo',
  'Ruby',
  'Otto',
];
