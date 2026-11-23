/**
 * Parties (M12c, D-041): guests arrive together as solo guests, couples, groups of friends or
 * families with kids. Content and tuning only; the rules live in `src/sim/systems/parties.ts`.
 */
import type { FurnitureDefId } from './furniture';

export type PartyKind = 'solo' | 'couple' | 'friends' | 'family';

/** Happiness reason a seated-together party earns (solo guests earn none). */
export type PartyBonusReason = 'friends' | 'family';

export interface PartyKindDef {
  /** Adults in the party [min, max] (an integer drawn from the seeded RNG). */
  adults: readonly [number, number];
  /** Kids in the party [min, max]. */
  kids: readonly [number, number];
  bonus: PartyBonusReason | null;
}

export const PARTY_KINDS: Record<PartyKind, PartyKindDef> = {
  solo: { adults: [1, 1], kids: [0, 0], bonus: null },
  couple: { adults: [2, 2], kids: [0, 0], bonus: 'friends' },
  friends: { adults: [2, 4], kids: [0, 0], bonus: 'friends' },
  family: { adults: [2, 2], kids: [1, 2], bonus: 'family' },
};

/** Fixed iteration order of the kinds (keeps the weighted pick deterministic). */
export const PARTY_KIND_IDS: readonly PartyKind[] = ['solo', 'couple', 'friends', 'family'];

/**
 * Relative weights of the party kinds by rank (index 0 = Rank 1; the last row is used from there
 * on). Rank 1 has only solo guests and couples: the starting tables seat two. Families and
 * groups need a table for 3 or 4 (Rank 2 shop).
 */
export const PARTY_MIX: readonly Record<PartyKind, number>[] = [
  { solo: 60, couple: 40, friends: 0, family: 0 },
  { solo: 52, couple: 38, friends: 4, family: 6 },
  { solo: 35, couple: 27, friends: 18, family: 20 },
  { solo: 28, couple: 24, friends: 22, family: 26 },
];

/** Happiness points each member gets for sitting down together (all kinds but solo). */
export const PARTY_BONUS_POINTS = 5;

/** Furniture that makes up a Children's Area (M16 fills this in; empty = the area cannot exist yet). */
export const CHILDRENS_AREA_PIECES: readonly FurnitureDefId[] = [];
/** Family weight multiplier while the restaurant has a Children's Area. */
export const CHILDRENS_AREA_FAMILY_BOOST = 1.6;

/** Palette variants of the kid sprite (kid, kid1, kid2). */
export const KID_VARIANTS = 3;
/** Kids pick their dish among this many of the cheapest unlocked recipes. */
export const KID_MENU_SIZE = 2;

/** First names of kids (cosmetic; seeded pick). */
export const KID_NAMES: readonly string[] = [
  'Pip',
  'Milo',
  'Zoe',
  'Finn',
  'Lily',
  'Max',
  'Ella',
  'Jonas',
  'Maja',
  'Kit',
];
