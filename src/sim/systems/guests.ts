import { GUEST_PAY_SEC } from '../../data/balance';
import { HAPPINESS_POINTS, LOVE_AT } from '../../data/happiness';
import { FURNITURE } from '../../data/furniture';
import { GUEST_TYPES } from '../../data/guests';
import { DOOR_X, DOOR_Y, WAITING_SPOTS } from '../../data/layout';
import { RECIPE_IDS } from '../../data/recipes';
import { FACING_DIR, isGuest, stepCharacter, type Guest, type IsoDir } from '../characters';
import type { Emitter, GameEvents, GuestLeaveReason } from '../events';
import { chairFacing, rotatedUseSpots, type Furniture } from '../grid';
import { findPath, type TilePos, type WalkGrid } from '../pathfinding';
import { rngInt, rngNext, rngPick } from '../rng';
import type { GameState } from '../state';
import { addFame } from './fame';
import {
  awardHappiness,
  beginStep,
  checkSlow,
  fameFor,
  onSeated,
  onServed,
  tipFor,
} from './happiness';
import { isChairUsable } from './build';
import { requestOrder } from './jobs';
import { assignSeats, kidMenu, liveMembers, mayUseChair, pruneParties, seatGroups } from './parties';
import { tickCampaign } from './campaigns';
import { departTail, leaveSide } from '../street';
import { rollGift } from './market';
import { priceAtLevel } from './recipes';
import { checkMoments } from './moments';
import {
  fameMultiplier,
  onRegularPaid,
  recordServed,
  seatPatienceSec,
  spawnRegularGuests,
  usualRecipe,
} from './regulars';
import { secToTicks, spawnParty, spawnRushParties } from './spawner';

export interface GuestContext {
  state: GameState;
  walk: WalkGrid;
  events: Emitter<GameEvents>;
}

function chairs(state: GameState): Furniture[] {
  return state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
}

function furnitureById(state: GameState, id: string): Furniture | undefined {
  return state.furniture.find((f) => f.id === id);
}

/** Direction a guest sitting on the chair faces: the way the chair points. */
export function seatFacing(chair: Furniture): IsoDir {
  return FACING_DIR[chairFacing(chair.rot)];
}

function currentTile(g: Guest): TilePos {
  return { x: Math.round(g.x), y: Math.round(g.y) };
}

/**
 * Plans a path for a guest. A guest between tiles first finishes the step it is on, so the path
 * starts from the tile it is heading to. Returns false (path untouched) when there is no route.
 */
function planPath(
  ctx: GuestContext,
  g: Guest,
  goal: TilePos,
  opts: { allowGoalBlocked?: boolean; allowStartBlocked?: boolean } = {},
): boolean {
  const from = g.path[0] ?? currentTile(g);
  const path = findPath(ctx.walk, from, goal, {
    ...opts,
    // Standing on a chair (blocked tile) is only possible for a seated/standing-up guest.
    allowStartBlocked: opts.allowStartBlocked && g.path.length === 0,
  });
  if (!path) return false;
  g.path = path;
  return true;
}

function randomTicks(state: GameState, range: readonly [number, number]): number {
  return rngInt(state, secToTicks(range[0]), secToTicks(range[1]));
}

/** Furniture ids of the chairs some guest has claimed. */
function takenChairs(state: GameState): Set<string> {
  const taken = new Set<string>();
  for (const c of state.characters) if (isGuest(c) && c.seatId) taken.add(c.seatId);
  return taken;
}

/**
 * Claims the nearest free reachable chair for one guest (a solo guest, a regular's companion or
 * a party member whose party is already seated); returns true on success.
 */
function tryClaimSeat(ctx: GuestContext, g: Guest): boolean {
  const { state } = ctx;
  const taken = takenChairs(state);
  // A companion or party member prefers the free chair nearest to a seated partner's.
  const partner = g.companionOf
    ? state.characters.find((c) => c.id === g.companionOf && isGuest(c))
    : g.partyId
      ? state.characters.find((c) => isGuest(c) && c.partyId === g.partyId && c !== g && c.seatId)
      : undefined;
  const partnerChair =
    partner && isGuest(partner) && partner.seatId
      ? furnitureById(state, partner.seatId)
      : undefined;
  const here = partnerChair ? { x: partnerChair.x, y: partnerChair.y } : currentTile(g);
  // A guest on their own fills tables that are already taken first, leaving whole tables free
  // for couples and families (D-041).
  const groupFree = new Map<string, number>();
  if (!partnerChair) {
    for (const group of seatGroups(state)) {
      const n = group.filter((c) => !taken.has(c.id)).length;
      for (const c of group) groupFree.set(c.id, n);
    }
  }
  const free = chairs(state)
    .filter((f) => !taken.has(f.id) && isChairUsable(state, f) && mayUseChair(g, f))
    .map((f, i) => ({
      f,
      i,
      d: Math.abs(f.x - here.x) + Math.abs(f.y - here.y),
      n: groupFree.get(f.id) ?? 0,
    }))
    .sort((a, b) => a.n - b.n || a.d - b.d || a.i - b.i);
  for (const { f } of free) {
    if (planPath(ctx, g, { x: f.x, y: f.y }, { allowGoalBlocked: true })) {
      g.seatId = f.id;
      g.phase = 'walkingToSeat';
      g.waitSpot = null;
      g.errand = null; // a seat beats the snack: the claim on the machine is dropped
      return true;
    }
  }
  return false;
}

/**
 * Claims seats for a whole party at once: all of them at one table (or a run of touching
 * tables), or none (D-041). Everyone gets a route first, so the claim is atomic.
 */
function tryClaimPartySeats(ctx: GuestContext, members: readonly Guest[]): boolean {
  const { state } = ctx;
  const taken = takenChairs(state);
  const first = members[0];
  if (!first) return false;
  const here = currentTile(first);
  for (const group of seatGroups(state)) {
    const free = group
      .filter((f) => !taken.has(f.id))
      .map((f, i) => ({ f, i, d: Math.abs(f.x - here.x) + Math.abs(f.y - here.y) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .map((e) => e.f);
    if (free.length < members.length) continue;
    const seats = assignSeats(members, free);
    if (!seats) continue;
    const paths = members.map((m, i) => {
      const seat = seats[i] as Furniture;
      return findPath(ctx.walk, m.path[0] ?? currentTile(m), { x: seat.x, y: seat.y }, {
        allowGoalBlocked: true,
      });
    });
    if (paths.some((p) => p === null)) continue;
    members.forEach((m, i) => {
      m.path = paths[i] as TilePos[];
      m.seatId = (seats[i] as Furniture).id;
      m.phase = 'walkingToSeat';
      m.waitSpot = null;
      m.errand = null;
    });
    return true;
  }
  return false;
}

function startLeaving(ctx: GuestContext, g: Guest, reason: GuestLeaveReason): void {
  g.phase = 'leaving';
  g.leaveReason = reason;
  g.errand = null;
  const door = { x: DOOR_X, y: DOOR_Y };
  if (!planPath(ctx, g, door, { allowStartBlocked: g.seatId !== null })) {
    // No route out (should not happen): drop the guest so it can never get stuck.
    g.path = [];
    g.phase = 'gone';
    return;
  }
  // Out through the door and away along the sidewalk (members of a party go the same way).
  g.path.push(...departTail(leaveSide(g.partyId ?? g.id)));
}

/** Frees the claimed chair once the guest has fully stepped off it. */
function releaseSeatIfOff(ctx: GuestContext, g: Guest): void {
  if (!g.seatId) return;
  const chair = furnitureById(ctx.state, g.seatId);
  if (!chair || Math.abs(g.x - chair.x) + Math.abs(g.y - chair.y) >= 1) g.seatId = null;
}

// ---- Errands: vending machine and toilet (M12) ------------------------------------------

/** Tile a guest stands on to use the piece (its first use spot, rotated). */
function useSpotOf(f: Furniture): { tile: TilePos; dir: IsoDir } | null {
  const spot = rotatedUseSpots(f.defId, f.rot)[0];
  return spot
    ? { tile: { x: f.x + spot.dx, y: f.y + spot.dy }, dir: FACING_DIR[spot.facing] }
    : null;
}

/** Nearest piece of the interaction kind that no guest has claimed (one user at a time). */
function nearestFree(state: GameState, g: Guest, kind: 'vending' | 'toilet'): Furniture | null {
  const claimed = new Set<string>();
  for (const c of state.characters) if (isGuest(c) && c.errand) claimed.add(c.errand.furnitureId);
  const here = currentTile(g);
  let best: { f: Furniture; d: number } | null = null;
  for (const f of state.furniture) {
    if (FURNITURE[f.defId].interaction?.kind !== kind || claimed.has(f.id)) continue;
    const spot = useSpotOf(f);
    if (!spot) continue;
    const d = Math.abs(spot.tile.x - here.x) + Math.abs(spot.tile.y - here.y);
    if (!best || d < best.d) best = { f, d };
  }
  return best?.f ?? null;
}

/** Sends the guest to the piece and claims it; false (nothing changed) when there is no route. */
function beginErrand(
  ctx: GuestContext,
  g: Guest,
  f: Furniture,
  allowStartBlocked: boolean,
): boolean {
  const def = FURNITURE[f.defId].interaction;
  const spot = useSpotOf(f);
  if (!def || !spot || !planPath(ctx, g, spot.tile, { allowStartBlocked })) return false;
  g.errand = { kind: def.kind, furnitureId: f.id, stage: 'walking', timer: 0 };
  return true;
}

/** Arrived at the piece: starts the timed use and turns to face it. Returns the piece or null. */
function startUsing(ctx: GuestContext, g: Guest): Furniture | null {
  const e = g.errand;
  const f = e ? furnitureById(ctx.state, e.furnitureId) : undefined;
  const def = f ? FURNITURE[f.defId].interaction : undefined;
  if (!e || !f || !def) {
    g.errand = null;
    return null;
  }
  e.stage = 'using';
  e.timer = secToTicks(def.useSec);
  const spot = useSpotOf(f);
  if (spot) g.dir = spot.dir;
  return f;
}

/** A finished use: coins and happiness by the piece's level. */
function finishUsing(ctx: GuestContext, g: Guest, f: Furniture): void {
  const { state, events } = ctx;
  const def = FURNITURE[f.defId].interaction;
  g.errand = null;
  if (!def) return;
  const coins = def.coins?.[f.level - 1] ?? 0;
  awardHappiness(g, def.reason, def.points[f.level - 1] ?? 0);
  if (coins > 0) {
    state.money += coins;
    events.emit('moneyChanged', { money: state.money });
  }
  events.emit('errandDone', { guestId: g.id, kind: def.kind, coins });
}

/** A guest waiting for a seat may snack at a free vending machine (decided once per guest). */
function updateWaitingErrand(ctx: GuestContext, g: Guest, arrived: boolean): void {
  const { state } = ctx;
  const e = g.errand;
  if (e) {
    if (e.stage === 'walking') {
      if (arrived) startUsing(ctx, g);
    } else if (--e.timer <= 0) {
      const f = furnitureById(state, e.furnitureId);
      if (f) finishUsing(ctx, g, f);
      else g.errand = null;
      // Back to the waiting spot (a seat claim is checked first on every tick).
      if (g.waitSpot) planPath(ctx, g, g.waitSpot);
    }
    return;
  }
  if (g.snackAsked || !g.waitSpot || !arrived) return;
  const f = nearestFree(state, g, 'vending');
  const def = f ? FURNITURE[f.defId].interaction : undefined;
  if (!f || !def) return; // no machine, or all busy: look again next tick (no dice rolled)
  g.snackAsked = true;
  if (rngNext(state) < def.chance) beginErrand(ctx, g, f, false);
}

/** After eating: with the toilet's chance the guest visits it before paying. */
function maybeVisitToilet(ctx: GuestContext, g: Guest): boolean {
  const f = nearestFree(ctx.state, g, 'toilet');
  const def = f ? FURNITURE[f.defId].interaction : undefined;
  if (!f || !def) return false;
  if (rngNext(ctx.state) >= def.chance) return false;
  if (!beginErrand(ctx, g, f, true)) return false;
  g.phase = 'toilet';
  return true;
}

/** The guest pays (dish plus tip), gives fame and may leave a gift; then they get up. */
export function payAndFinish(ctx: GuestContext, g: Guest): void {
  const { state, events } = ctx;
  g.phase = 'paying';
  g.timer = secToTicks(GUEST_PAY_SEC);
  const price = g.recipeId ? priceAtLevel(g.recipeId, state.recipes[g.recipeId].level) : 0;
  const tip = tipFor(price, g.happiness);
  const fame = fameFor(g.happiness) * fameMultiplier(g);
  state.money += price + tip;
  events.emit('paid', {
    guestId: g.id,
    price,
    tip,
    amount: price + tip,
    fame,
    x: g.x,
    y: g.y,
  });
  events.emit('moneyChanged', { money: state.money });
  addFame(state, events, fame);
  if (g.recipeId) recordServed(state, g.recipeId);
  const heart = onRegularPaid(state, events, g);
  if (heart) events.emit('guestEmote', { guestId: g.id, emote: 'heart' });
  else if (g.happiness >= LOVE_AT) events.emit('guestEmote', { guestId: g.id, emote: 'love' });
  rollGift(state, events, g);
  checkMoments(state, events);
}

/** The dish arrived: the guest starts eating (called by the staff system). */
export function startEating(ctx: GuestContext, g: Guest): void {
  g.phase = 'eating';
  g.timer = randomTicks(ctx.state, GUEST_TYPES[g.typeId].eatSec);
  onServed(ctx.state, g);
  ctx.events.emit('guestEmote', { guestId: g.id, emote: 'tasty' });
}

/** Sends a waiting guest to the next waiting spot near the door. */
function takeWaitSpot(ctx: GuestContext, g: Guest): void {
  const waiting = ctx.state.characters.filter((c) => isGuest(c) && c.waitSpot).length;
  const spot = WAITING_SPOTS[waiting % WAITING_SPOTS.length];
  if (!spot) return;
  g.waitSpot = { ...spot };
  planPath(ctx, g, spot);
}

function updateGuest(ctx: GuestContext, g: Guest): void {
  const { state, events } = ctx;
  const type = GUEST_TYPES[g.typeId];
  stepCharacter(g, type.walkSpeed);
  checkSlow(state, events, g);
  const arrived = g.path.length === 0;

  switch (g.phase) {
    case 'arriving':
      if (arrived) {
        g.phase = 'waitingForSeat';
        g.timer = secToTicks(seatPatienceSec(g, type.seatPatienceSec));
        // The seating clock starts at the door, not out on the sidewalk.
        beginStep(state, g);
      }
      break;

    case 'waitingForSeat': {
      // A party waits together: the first one waiting drives the claim and the patience.
      const party = g.partyId ? liveMembers(state, g.partyId) : [];
      const together =
        party.length > 1 && party.every((m) => m.phase === 'arriving' || m.phase === 'waitingForSeat');
      const driver = party.find((m) => m.phase === 'waitingForSeat');
      if (together && driver !== g) {
        if (!g.waitSpot && arrived) takeWaitSpot(ctx, g);
        break;
      }
      const seated =
        together && party.every((m) => m.phase === 'waitingForSeat')
          ? tryClaimPartySeats(ctx, party)
          : together
            ? false
            : tryClaimSeat(ctx, g);
      if (seated) break;
      const group = together ? party : [g];
      if (state.clock.phase === 'closing') {
        // Closing time: nobody new gets seated, and this is not the guest's fault (no angry emote).
        for (const m of group) startLeaving(ctx, m, 'closed');
        break;
      }
      if (--g.timer <= 0) {
        for (const m of group) {
          events.emit('guestEmote', { guestId: m.id, emote: 'angry' });
          startLeaving(ctx, m, 'noSeat');
        }
        break;
      }
      if (!g.waitSpot && arrived) {
        takeWaitSpot(ctx, g);
      } else if (!g.partyId) {
        updateWaitingErrand(ctx, g, arrived);
      }
      break;
    }

    case 'walkingToSeat':
      if (arrived) {
        const chair = g.seatId ? furnitureById(state, g.seatId) : undefined;
        if (!chair) {
          startLeaving(ctx, g, 'noSeat');
          break;
        }
        g.dir = seatFacing(chair);
        g.phase = 'browsing';
        g.timer = randomTicks(state, type.browseSec);
        onSeated(state, g);
        events.emit('guestSeated', { guestId: g.id, seatId: chair.id });
      }
      break;

    case 'browsing':
      if (--g.timer <= 0) {
        // A regular always orders their favorite when it is on the menu.
        const usual = usualRecipe(state, g);
        if (usual) awardHappiness(g, 'usual', HAPPINESS_POINTS.usual);
        const unlocked = RECIPE_IDS.filter((id) => state.recipes[id].unlocked);
        g.recipeId = usual ?? rngPick(state, g.kid ? kidMenu(state) : unlocked);
        g.phase = 'wantsToOrder';
        beginStep(state, g);
        events.emit('guestEmote', { guestId: g.id, emote: 'hand' });
        requestOrder(state, g, g.recipeId);
      }
      break;

    case 'wantsToOrder':
    case 'waitingForFood':
      // Passive: the staff system moves the guest on (order taken, dish served).
      break;

    case 'eating':
      if (--g.timer <= 0 && !maybeVisitToilet(ctx, g)) payAndFinish(ctx, g);
      break;

    case 'toilet': {
      releaseSeatIfOff(ctx, g);
      const e = g.errand;
      if (!e) {
        payAndFinish(ctx, g); // defensive: the errand vanished
      } else if (e.stage === 'walking') {
        if (arrived && !startUsing(ctx, g)) payAndFinish(ctx, g);
      } else if (--e.timer <= 0) {
        const f = furnitureById(state, e.furnitureId);
        if (f) finishUsing(ctx, g, f);
        else g.errand = null;
        payAndFinish(ctx, g);
      }
      break;
    }

    case 'paying':
      if (--g.timer <= 0) {
        g.timer = 0;
        // A party leaves together, once the last one has paid.
        const party = g.partyId ? liveMembers(state, g.partyId) : [g];
        if (party.every((m) => m.phase === 'paying' && m.timer <= 0)) {
          for (const m of party) startLeaving(ctx, m, 'done');
        }
      }
      break;

    case 'leaving':
      releaseSeatIfOff(ctx, g);
      if (arrived) g.phase = 'gone';
      break;

    case 'gone':
      break;
  }
}

/** Spawns arrivals, advances every guest by one tick and removes the ones that are gone. */
export function tickGuests(ctx: GuestContext): void {
  const { state, events } = ctx;
  tickCampaign(state, events);
  for (const fresh of [...spawnParty(state), ...spawnRushParties(state)]) {
    state.characters.push(fresh);
    events.emit('guestArrived', { guestId: fresh.id });
  }
  for (const regular of spawnRegularGuests(state, events)) {
    state.characters.push(regular);
    events.emit('guestArrived', { guestId: regular.id });
  }
  for (const c of state.characters) {
    if (isGuest(c)) updateGuest(ctx, c);
  }
  state.characters = state.characters.filter((c) => {
    if (!isGuest(c) || c.phase !== 'gone') return true;
    events.emit('guestLeft', { guestId: c.id, reason: c.leaveReason ?? 'done' });
    return false;
  });
  pruneParties(state);
}
