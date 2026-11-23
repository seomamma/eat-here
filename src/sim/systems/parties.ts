import { FURNITURE } from '../../data/furniture';
import {
  CHILDRENS_AREA_FAMILY_BOOST,
  CHILDRENS_AREA_PIECES,
  KID_MENU_SIZE,
  PARTY_KINDS,
  PARTY_KIND_IDS,
  PARTY_MIX,
  type PartyKind,
} from '../../data/parties';
import { RECIPE_IDS, RECIPES, type RecipeId } from '../../data/recipes';
import { isGuest, type Guest } from '../characters';
import { FACING_STEP, buildOccupancy, chairFacing, footprintTiles, type Furniture } from '../grid';
import { rngInt, rngNext } from '../rng';
import type { GameState } from '../state';

/** Guests that came in together (two or more; solo guests have no party). */
export interface Party {
  id: string;
  kind: PartyKind;
  /** Leader first, then the other adults, then the kids (creation order). */
  memberIds: string[];
}

export interface PartyPlan {
  kind: PartyKind;
  adults: number;
  kids: number;
}

export function partySize(plan: PartyPlan): number {
  return plan.adults + plan.kids;
}

/** Weights of the kinds at a rank (a Children's Area boosts families). */
export function partyWeights(
  state: Pick<GameState, 'rank' | 'furniture'>,
): Record<PartyKind, number> {
  const row = PARTY_MIX[Math.min(state.rank, PARTY_MIX.length) - 1] ?? PARTY_MIX[0];
  const out = { ...row } as Record<PartyKind, number>;
  if (state.furniture.some((f) => CHILDRENS_AREA_PIECES.includes(f.defId))) {
    out.family *= CHILDRENS_AREA_FAMILY_BOOST;
  }
  return out;
}

/** Draws the next party's kind and size from the seeded RNG. */
export function rollPartyPlan(state: GameState): PartyPlan {
  const weights = partyWeights(state);
  const total = PARTY_KIND_IDS.reduce((n, k) => n + weights[k], 0);
  let pick = rngNext(state) * total;
  let kind: PartyKind = 'solo';
  for (const k of PARTY_KIND_IDS) {
    if (weights[k] <= 0) continue;
    kind = k;
    if (pick < weights[k]) break;
    pick -= weights[k];
  }
  const def = PARTY_KINDS[kind];
  return {
    kind,
    adults: rngInt(state, def.adults[0], def.adults[1]),
    kids: rngInt(state, def.kids[0], def.kids[1]),
  };
}

export function partyOf(state: Pick<GameState, 'parties'>, g: Guest): Party | undefined {
  return g.partyId ? state.parties.find((p) => p.id === g.partyId) : undefined;
}

/** Guests of the party that are still in the restaurant and not on their way out, leader first. */
export function liveMembers(state: Pick<GameState, 'characters'>, partyId: string): Guest[] {
  const out: Guest[] = [];
  for (const c of state.characters) {
    if (isGuest(c) && c.partyId === partyId && c.phase !== 'leaving' && c.phase !== 'gone') {
      out.push(c);
    }
  }
  return out;
}

/** Removes parties without anybody left in the restaurant. */
export function pruneParties(state: GameState): void {
  const alive = new Set<string>();
  for (const c of state.characters) if (isGuest(c) && c.partyId) alive.add(c.partyId);
  state.parties = state.parties.filter((p) => alive.has(p.id));
  for (const p of state.parties) {
    p.memberIds = p.memberIds.filter((id) => state.characters.some((c) => c.id === id));
  }
}

/** Kids pick among the cheapest unlocked dishes (data: `KID_MENU_SIZE`). */
export function kidMenu(state: Pick<GameState, 'recipes'>): RecipeId[] {
  const unlocked = RECIPE_IDS.filter((id) => state.recipes[id].unlocked);
  return unlocked
    .map((id, i) => ({ id, i }))
    .sort((a, b) => RECIPES[a.id].price - RECIPES[b.id].price || a.i - b.i)
    .slice(0, KID_MENU_SIZE)
    .map((e) => e.id);
}

/** True when the guest may sit on the chair: only kids use kids-only seats. */
export function mayUseChair(g: Pick<Guest, 'kid'>, chair: Furniture): boolean {
  return !FURNITURE[chair.defId].kidsOnly || g.kid;
}

/**
 * Groups of usable chairs that share a table or a run of touching tables (a "table group"):
 * a party sits within one group. Groups and chairs keep furniture order (deterministic).
 */
export function seatGroups(state: Pick<GameState, 'furniture'>): Furniture[][] {
  const tables = state.furniture.filter((f) => FURNITURE[f.defId].kind === 'table');
  const owner = new Map<string, number>();
  tables.forEach((t, i) => {
    for (const tile of footprintTiles(t.defId, t.x, t.y, t.rot))
      owner.set(`${tile.x},${tile.y}`, i);
  });
  // Union touching tables.
  const parent = tables.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    return r;
  };
  for (const [key, i] of owner) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    for (const n of [`${x + 1},${y}`, `${x},${y + 1}`]) {
      const j = owner.get(n);
      if (j !== undefined && find(i) !== find(j)) parent[find(i)] = find(j);
    }
  }
  const occupancy = buildOccupancy(state.furniture);
  const groups = new Map<number, Furniture[]>();
  for (const chair of state.furniture) {
    if (FURNITURE[chair.defId].kind !== 'chair') continue;
    const step = FACING_STEP[chairFacing(chair.rot)];
    const faced = occupancy.get(`${chair.x + step.x},${chair.y + step.y}`);
    const t = tables.findIndex((f) => f.id === faced); // a chair facing no table is not usable
    if (t < 0) continue;
    const root = find(t);
    const list = groups.get(root) ?? [];
    list.push(chair);
    groups.set(root, list);
  }
  return [...groups.values()];
}

/**
 * Picks one chair per member (same order as `members`) out of `chairs`, which are sorted by
 * preference. Kids take kids-only chairs first, then ordinary ones; adults only ordinary ones.
 * Returns null when the party does not fit.
 */
export function assignSeats(
  members: readonly Pick<Guest, 'kid'>[],
  chairs: readonly Furniture[],
): Furniture[] | null {
  const high = chairs.filter((c) => FURNITURE[c.defId].kidsOnly);
  const plain = chairs.filter((c) => !FURNITURE[c.defId].kidsOnly);
  const out: Furniture[] = [];
  // Adults first (they get the closest ordinary chairs), then kids.
  const order = members.map((m, i) => ({ m, i })).sort((a, b) => Number(a.m.kid) - Number(b.m.kid));
  for (const { m, i } of order) {
    const chair = m.kid && high.length > 0 ? high.shift() : plain.shift();
    if (!chair) return null;
    out[i] = chair;
  }
  return out;
}
