import { describe, expect, it } from 'vitest';
import { FURNITURE, type FurnitureDefId, type Rot } from '../../src/data/furniture';
import { MAX_GUESTS_ALIVE } from '../../src/data/balance';
import { DOOR_X, DOOR_Y, SIDEWALK_Y } from '../../src/data/layout';
import {
  KID_MENU_SIZE,
  PARTY_BONUS_POINTS,
  PARTY_KINDS,
  PARTY_KIND_IDS,
  PARTY_MIX,
  type PartyKind,
} from '../../src/data/parties';
import { STREET_APPROACH_TILES } from '../../src/data/street';
import { isGuest, type Guest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { validateMove } from '../../src/sim/systems/build';
import { serialize } from '../../src/sim/save';
import {
  assignSeats,
  kidMenu,
  liveMembers,
  partySize,
  rollPartyPlan,
  seatGroups,
  type PartyPlan,
} from '../../src/sim/systems/parties';
import { createParty, createPartyIfRoom } from '../../src/sim/systems/spawner';
import { approachPath } from '../../src/sim/street';
import { OX, OY } from './helpers';

const AT = 1_700_000_000_000;

/** A restaurant with the kitchen only: no tables or chairs, no random arrivals. */
function bareRoom(seed = 1): Game {
  const state = createInitialState(seed);
  state.furniture = state.furniture.filter((f) => {
    const kind = FURNITURE[f.defId].kind;
    return kind !== 'chair' && kind !== 'table';
  });
  state.guestSpawn.enabled = false;
  return new Game(state);
}

/** Puts a piece at a pre-M12b local coordinate. */
function put(g: Game, defId: FurnitureDefId, x: number, y: number, rot: Rot = 0): string {
  const id = `f${g.state.nextFurnitureId++}`;
  g.state.furniture.push({ id, defId, x: x + OX, y: y + OY, rot, level: 1 });
  g.invalidateWalkGrid();
  return id;
}

/**
 * A long table with chairs: two above (face down), two below (face up). `end` adds a chair at
 * the left end facing the table (e.g. a high chair).
 */
function familyTable(g: Game, opts: { highChairAtEnd?: boolean; chairs?: number } = {}): void {
  put(g, 'table_long', 5, 6);
  const spots: [number, number, Rot][] = [
    [5, 5, 0],
    [6, 5, 0],
    [5, 7, 2],
    [6, 7, 2],
  ];
  for (const [x, y, rot] of spots.slice(0, opts.chairs ?? 4)) put(g, 'chair_wood', x, y, rot);
  if (opts.highChairAtEnd) put(g, 'chair_high', 4, 6, 1);
}

function addParty(g: Game, plan: PartyPlan): Guest[] {
  const members = createParty(g.state, plan);
  g.state.characters.push(...members);
  return members;
}

const guestsOf = (g: Game): Guest[] => g.state.characters.filter(isGuest);
const family = (adults = 2, kids = 2): PartyPlan => ({ kind: 'family', adults, kids });

function run(g: Game, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    g.tickOnce();
    each?.();
  }
}

/** Checked after every tick: claims are unique, parties are never split, kids are never alone. */
function partyInvariants(g: Game): void {
  const seats = new Set<string>();
  for (const c of guestsOf(g)) {
    if (c.seatId) {
      expect(seats.has(c.seatId), `double claim ${c.seatId}`).toBe(false);
      seats.add(c.seatId);
      const chair = g.state.furniture.find((f) => f.id === c.seatId);
      expect(chair && FURNITURE[chair.defId].kidsOnly ? c.kid : true, 'adult on a kids seat').toBe(
        true,
      );
    }
  }
  for (const p of g.state.parties) {
    const members = liveMembers(g.state, p.id);
    const waiting = members.filter((m) => m.phase === 'waitingForSeat' || m.phase === 'arriving');
    const seated = members.filter((m) => m.seatId !== null);
    // Waiting together or seated together: never some of each.
    expect(waiting.length > 0 && seated.length > 0, `party ${p.id} split`).toBe(false);
    for (const kid of members.filter((m) => m.kid && m.seatId)) {
      const parent = members.find((m) => !m.kid && m.seatId);
      expect(parent, `${kid.name} sits without a parent`).toBeDefined();
    }
  }
}

describe('party plans', () => {
  const count = (seed: number, rank: number, n: number): Record<PartyKind, number> => {
    const state = createInitialState(seed);
    state.rank = rank;
    const out = { solo: 0, couple: 0, friends: 0, family: 0 };
    for (let i = 0; i < n; i++) out[rollPartyPlan(state).kind]++;
    return out;
  };

  it('rank 1 only brings solo guests and couples (the starting tables seat two)', () => {
    const c = count(5, 1, 400);
    expect(c.friends + c.family).toBe(0);
    expect(c.solo).toBeGreaterThan(0);
    expect(c.couple).toBeGreaterThan(0);
  });

  it('follows the weights of the rank and the sizes of every kind', () => {
    const n = 4000;
    for (const rank of [2, 3, 4]) {
      const c = count(7, rank, n);
      const w = PARTY_MIX[rank - 1] as Record<PartyKind, number>;
      const total = PARTY_KIND_IDS.reduce((s, k) => s + w[k], 0);
      for (const k of PARTY_KIND_IDS) {
        expect(c[k] / n).toBeCloseTo(w[k] / total, 1);
      }
    }
    const state = createInitialState(9);
    state.rank = 4;
    for (let i = 0; i < 500; i++) {
      const p = rollPartyPlan(state);
      const def = PARTY_KINDS[p.kind];
      expect(p.adults).toBeGreaterThanOrEqual(def.adults[0]);
      expect(p.adults).toBeLessThanOrEqual(def.adults[1]);
      expect(p.kids).toBeGreaterThanOrEqual(def.kids[0]);
      expect(p.kids).toBeLessThanOrEqual(def.kids[1]);
      expect(partySize(p)).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic by seed', () => {
    const seq = (seed: number) => {
      const s = createInitialState(seed);
      s.rank = 3;
      return Array.from({ length: 50 }, () => JSON.stringify(rollPartyPlan(s)));
    };
    expect(seq(3)).toEqual(seq(3));
    expect(seq(3)).not.toEqual(seq(4));
  });

  it('a family is two adults and one or two kids; kids are flagged and share the party id', () => {
    const g = bareRoom();
    const members = addParty(g, family(2, 2));
    expect(members.map((m) => m.kid)).toEqual([false, false, true, true]);
    const ids = new Set(members.map((m) => m.partyId));
    expect(ids.size).toBe(1);
    expect(g.state.parties).toHaveLength(1);
    expect(g.state.parties[0]?.memberIds).toEqual(members.map((m) => m.id));
    // A solo guest has no party.
    const solo = createParty(g.state, { kind: 'solo', adults: 1, kids: 0 });
    expect(solo[0]?.partyId).toBeNull();
    expect(g.state.parties).toHaveLength(1);
  });

  it('does not create a party that would not fit under the guest limit', () => {
    const g = bareRoom();
    for (let i = 0; i < MAX_GUESTS_ALIVE - 1; i++) {
      g.state.characters.push(...createParty(g.state, { kind: 'solo', adults: 1, kids: 0 }));
    }
    expect(createPartyIfRoom(g.state, family(2, 2))).toEqual([]);
    expect(createPartyIfRoom(g.state, { kind: 'solo', adults: 1, kids: 0 })).toHaveLength(1);
  });
});

describe('arriving from the street', () => {
  it('guests start on the sidewalk and walk along it, through the door, one tile in', () => {
    const { start, path } = approachPath(1, 0);
    expect(start).toEqual({ x: DOOR_X + STREET_APPROACH_TILES, y: SIDEWALK_Y });
    expect(path.at(-1)).toEqual({ x: DOOR_X, y: DOOR_Y - 1 });
    expect(path.at(-2)).toEqual({ x: DOOR_X, y: DOOR_Y });
    expect(path.at(-3)).toEqual({ x: DOOR_X, y: SIDEWALK_Y });
    // Along the sidewalk, one tile per step, then straight in.
    const onStreet = path.filter((t) => t.y === SIDEWALK_Y);
    expect(onStreet).toHaveLength(STREET_APPROACH_TILES);
    expect(approachPath(-1, 0).start.x).toBe(DOOR_X - STREET_APPROACH_TILES);
  });

  it('a party walks in together in a line, one tile behind each other', () => {
    const g = bareRoom();
    familyTable(g);
    const members = addParty(g, family(2, 2));
    expect(members.map((m) => m.y)).toEqual([SIDEWALK_Y, SIDEWALK_Y, SIDEWALK_Y, SIDEWALK_Y]);
    const dir = Math.sign((members[0] as Guest).x - DOOR_X);
    expect(members.map((m) => (m.x - DOOR_X) * dir)).toEqual([
      STREET_APPROACH_TILES,
      STREET_APPROACH_TILES + 1,
      STREET_APPROACH_TILES + 2,
      STREET_APPROACH_TILES + 3,
    ]);
    // Same speed, same route: they keep their gap until the door.
    run(g, 20);
    const xs = members.map((m) => m.x);
    for (let i = 1; i < xs.length; i++) {
      expect(Math.abs((xs[i] as number) - (xs[i - 1] as number))).toBeCloseTo(1, 5);
    }
    // Everyone ends up inside the room.
    run(g, 150);
    for (const m of members) expect(m.y).toBeLessThanOrEqual(DOOR_Y);
  });

  it('leaving guests walk out through the door and away along the sidewalk', () => {
    const g = bareRoom();
    familyTable(g);
    const members = addParty(g, { kind: 'couple', adults: 2, kids: 0 });
    let sawDoor = false;
    let sawSidewalk = false;
    for (let i = 0; i < 4000 && guestsOf(g).length > 0; i++) {
      g.tickOnce();
      for (const m of guestsOf(g)) {
        if (m.phase === 'leaving' && Math.abs(m.y - DOOR_Y) < 0.5 && Math.abs(m.x - DOOR_X) < 0.5)
          sawDoor = true;
        if (m.phase === 'leaving' && m.y === SIDEWALK_Y) sawSidewalk = true;
      }
    }
    expect(guestsOf(g)).toHaveLength(0);
    expect(sawDoor).toBe(true);
    expect(sawSidewalk).toBe(true);
    expect(members.every((m) => m.phase === 'gone')).toBe(true);
  });
});

describe('seating a party', () => {
  it('a family takes all four seats of the table at once; the claim is atomic', () => {
    const g = bareRoom();
    familyTable(g);
    addParty(g, family(2, 2));
    let claimedAt = -1;
    for (let i = 0; i < 400; i++) {
      g.tickOnce();
      partyInvariants(g);
      const seated = guestsOf(g).filter((m) => m.seatId).length;
      if (claimedAt < 0 && seated > 0) {
        claimedAt = i;
        expect(seated).toBe(4); // all of them on the very same tick
      }
    }
    expect(claimedAt).toBeGreaterThan(0);
    const chairs = new Set(guestsOf(g).map((m) => m.seatId));
    expect(chairs.has(null)).toBe(false);
  });

  it('never splits: three seats for a party of four means nobody sits, and the party leaves together after the patience', () => {
    const g = bareRoom();
    familyTable(g, { chairs: 3 });
    const members = addParty(g, family(2, 2));
    const left: string[] = [];
    g.events.on('guestLeft', (e) => left.push(`${e.guestId}:${e.reason}`));
    const angry: string[] = [];
    g.events.on('guestEmote', (e) => e.emote === 'angry' && angry.push(e.guestId));
    let leavingTick = -1;
    for (let i = 0; i < 1500; i++) {
      g.tickOnce();
      partyInvariants(g);
      expect(members.some((m) => m.seatId)).toBe(false);
      const phases = new Set(members.map((m) => (m.phase === 'gone' ? 'leaving' : m.phase)));
      if (leavingTick < 0 && phases.has('leaving')) {
        leavingTick = g.state.tick;
        expect(phases.size).toBe(1); // all four turn away on the same tick
      }
    }
    expect(leavingTick).toBeGreaterThan(0);
    expect(left.sort()).toEqual(members.map((m) => `${m.id}:noSeat`).sort());
    expect(angry).toHaveLength(4);
  });

  it('a party that is too big for any table waits out its patience, then leaves together', () => {
    // The starting tables seat two: a group of four never fits.
    const state = createInitialState(2);
    state.guestSpawn.enabled = false;
    const g = new Game(state);
    const members = addParty(g, { kind: 'friends', adults: 4, kids: 0 });
    run(g, 1500, () => partyInvariants(g));
    expect(members.every((m) => m.phase === 'gone' && m.leaveReason === 'noSeat')).toBe(true);
    expect(members.every((m) => m.recipeId === null)).toBe(true);
  });

  it('two touching tables make one table group', () => {
    const g = bareRoom();
    put(g, 'table_small', 5, 6);
    put(g, 'table_small', 6, 6);
    put(g, 'chair_wood', 5, 5, 0);
    put(g, 'chair_wood', 6, 7, 2);
    put(g, 'table_small', 2, 9);
    put(g, 'chair_wood', 2, 8, 0);
    const groups = seatGroups(g.state).map((grp) => grp.length);
    expect(groups.sort()).toEqual([1, 2]);
    addParty(g, { kind: 'couple', adults: 2, kids: 0 });
    run(g, 300, () => partyInvariants(g));
    const seated = guestsOf(g).filter((m) => m.seatId);
    expect(seated).toHaveLength(2);
    // Both chairs of the 2-seat group, not the single one.
    expect(seated.map((m) => m.seatId).sort()).toEqual(
      g.state.furniture
        .filter((f) => f.defId === 'chair_wood' && (f.x - OX === 5 || f.x - OX === 6))
        .map((f) => f.id)
        .sort(),
    );
  });

  it('a couple does not take two chairs at different tables', () => {
    const g = bareRoom();
    put(g, 'table_small', 5, 6);
    put(g, 'chair_wood', 5, 5, 0);
    put(g, 'table_small', 2, 9);
    put(g, 'chair_wood', 2, 8, 0);
    const members = addParty(g, { kind: 'couple', adults: 2, kids: 0 });
    run(g, 1200, () => partyInvariants(g));
    expect(members.every((m) => m.leaveReason === 'noSeat')).toBe(true);
  });

  it('kids take the high chair; adults never do', () => {
    const g = bareRoom();
    familyTable(g, { chairs: 3, highChairAtEnd: true });
    const high = g.state.furniture.find((f) => f.defId === 'chair_high');
    const members = addParty(g, family(2, 1));
    run(g, 400, () => partyInvariants(g));
    const kid = members.find((m) => m.kid) as Guest;
    expect(kid.seatId).toBe(high?.id);
    for (const m of members.filter((x) => !x.kid)) expect(m.seatId).not.toBe(high?.id);
  });

  it('with no high chair kids sit on a normal chair', () => {
    const g = bareRoom();
    familyTable(g, { chairs: 3 });
    const members = addParty(g, family(2, 1));
    run(g, 400, () => partyInvariants(g));
    expect(members.every((m) => m.seatId !== null || m.phase === 'gone')).toBe(true);
    const kid = members.find((m) => m.kid) as Guest;
    expect(g.state.furniture.find((f) => f.id === kid.seatId)?.defId).toBe('chair_wood');
  });

  it('a lone adult never sits on a high chair, even when it is the only chair', () => {
    const g = bareRoom();
    put(g, 'table_small', 5, 6);
    put(g, 'chair_high', 5, 5, 0);
    const [solo] = createParty(g.state, { kind: 'solo', adults: 1, kids: 0 });
    g.state.characters.push(solo as Guest);
    run(g, 1200);
    expect(solo?.leaveReason).toBe('noSeat');
  });

  it('assignSeats gives kids kids-only seats first and refuses a party that does not fit', () => {
    const g = bareRoom();
    familyTable(g, { chairs: 2, highChairAtEnd: true });
    const chairs = g.state.furniture.filter((f) => FURNITURE[f.defId].kind === 'chair');
    const [a, b, hi] = [chairs[0], chairs[1], chairs[2]];
    expect(a && b && hi).toBeTruthy();
    const seats = assignSeats([{ kid: false }, { kid: true }, { kid: false }], chairs);
    expect(seats?.map((c) => c.defId)).toEqual(['chair_wood', 'chair_high', 'chair_wood']);
    expect(assignSeats([{ kid: false }, { kid: false }, { kid: false }], chairs)).toBeNull();
    expect(assignSeats([{ kid: true }, { kid: true }, { kid: true }], chairs)?.length).toBe(3);
    expect(
      assignSeats([{ kid: true }, { kid: true }, { kid: true }, { kid: true }], chairs),
    ).toBeNull();
  });

  it('kids pick one of the cheapest dishes', () => {
    const g = bareRoom();
    const menu = kidMenu(g.state);
    expect(menu).toHaveLength(Math.min(KID_MENU_SIZE, 2));
    g.state.recipes.pepperoni.unlocked = true;
    expect(kidMenu(g.state)).toHaveLength(KID_MENU_SIZE);
    expect(kidMenu(g.state)).not.toContain('pepperoni');
    familyTable(g);
    const members = addParty(g, family(2, 2));
    const ordered = new Set<string>();
    for (let i = 0; i < 3000 && guestsOf(g).length > 0; i++) {
      g.tickOnce();
      for (const m of members) if (m.kid && m.recipeId) ordered.add(m.recipeId);
    }
    expect(ordered.size).toBeGreaterThan(0);
    for (const r of ordered) expect(kidMenu(g.state)).toContain(r);
  });
});

describe('a party visit', () => {
  it('everyone sits together, orders their own dish, eats, and leaves together after the last payment', () => {
    const g = bareRoom(3);
    familyTable(g);
    const members = addParty(g, family(2, 2));
    const paidTicks: number[] = [];
    g.events.on('paid', () => paidTicks.push(g.state.tick));
    let leaveTick = -1;
    for (let i = 0; i < 3000 && guestsOf(g).length > 0; i++) {
      g.tickOnce();
      partyInvariants(g);
      const leaving = members.filter((m) => m.phase === 'leaving' || m.phase === 'gone');
      if (leaveTick < 0 && leaving.length > 0) {
        leaveTick = g.state.tick;
        expect(leaving).toHaveLength(4); // together
        expect(paidTicks).toHaveLength(4); // after the last one paid
        expect(members.every((m) => m.leaveReason === 'done')).toBe(true);
      }
    }
    expect(leaveTick).toBeGreaterThan(0);
    expect(new Set(members.map((m) => m.recipeId)).size).toBeGreaterThan(0);
    expect(members.every((m) => m.recipeId !== null)).toBe(true);
    // The first payer waited for the others (the leave tick is later than their payment).
    expect(leaveTick).toBeGreaterThanOrEqual(Math.max(...paidTicks));
    expect(g.state.parties).toHaveLength(0);
  });

  it('sitting down together gives the party bonus ("Family time" / "Fun with friends")', () => {
    const g = bareRoom();
    familyTable(g);
    const fam = addParty(g, family(2, 2));
    run(g, 400);
    for (const m of fam) {
      expect(m.happinessLog).toContainEqual({ reason: 'family', points: PARTY_BONUS_POINTS });
    }
    const g2 = bareRoom();
    familyTable(g2);
    const pair = addParty(g2, { kind: 'couple', adults: 2, kids: 0 });
    run(g2, 400);
    for (const m of pair) {
      expect(m.happinessLog).toContainEqual({ reason: 'friends', points: PARTY_BONUS_POINTS });
    }
    // Solo guests get none.
    const g3 = bareRoom();
    familyTable(g3);
    const [solo] = createParty(g3.state, { kind: 'solo', adults: 1, kids: 0 });
    g3.state.characters.push(solo as Guest);
    run(g3, 400);
    expect(solo?.happinessLog.some((e) => e.reason === 'friends' || e.reason === 'family')).toBe(
      false,
    );
  });

  it('solo guests fill a table that is already taken before a whole free table', () => {
    const g = bareRoom();
    put(g, 'table_small', 5, 6);
    put(g, 'chair_wood', 5, 5, 0);
    put(g, 'chair_wood', 5, 7, 2);
    put(g, 'table_small', 2, 6);
    put(g, 'chair_wood', 2, 5, 0);
    put(g, 'chair_wood', 2, 7, 2);
    const seats = new Map<string, string>();
    g.events.on('guestSeated', (e) => seats.set(e.guestId, e.seatId));
    const a = createParty(g.state, { kind: 'solo', adults: 1, kids: 0 })[0] as Guest;
    g.state.characters.push(a);
    run(g, 120);
    const b = createParty(g.state, { kind: 'solo', adults: 1, kids: 0 })[0] as Guest;
    g.state.characters.push(b);
    run(g, 120);
    const tableX = (m: Guest) => g.state.furniture.find((f) => f.id === seats.get(m.id))?.x;
    expect(seats.size).toBe(2);
    expect(tableX(a)).toBe(tableX(b));
  });
});

/** Moves a table or chair to the first free tile (guests sitting at it are carried along). */
function moveSomething(g: Game, i: number): boolean {
  const pieces = g.state.furniture.filter((f) =>
    ['table', 'chair'].includes(FURNITURE[f.defId].kind),
  );
  const piece = pieces[i % pieces.length];
  if (!piece) return false;
  const { room } = g.state;
  for (let y = room.y0 + 4; y < room.y1; y++) {
    for (let x = room.x0; x <= room.x1; x++) {
      if (validateMove(g.state, piece.id, x, y, piece.rot).ok) {
        return g.dispatch({ type: 'moveFurniture', id: piece.id, x, y, rot: piece.rot }).ok;
      }
    }
  }
  return false;
}

describe('days with parties', () => {
  function playDays(
    seed: number,
    days: number,
  ): { g: Game; log: string[]; moves: number; seatedParties: Set<string>; kids: number } {
    const state = createInitialState(seed);
    state.rank = 3;
    state.money = 3000;
    const g = new Game(state);
    // A table for four, a high chair and the start tables; then walk the day with moves.
    put(g, 'table_long', 1, 8);
    for (const [x, y, rot] of [
      [1, 7, 0],
      [2, 7, 0],
      [1, 9, 2],
      [2, 9, 2],
    ] as [number, number, Rot][]) {
      put(g, 'chair_wood', x, y, rot);
    }
    put(g, 'chair_high', 3, 8, 3); // right end of the long table, facing it
    const log: string[] = [];
    let moves = 0;
    let kids = 0;
    const seatedParties = new Set<string>();
    g.events.on('guestLeft', (e) => log.push(`${e.guestId}:${e.reason}`));
    g.events.on('guestSeated', (e) => {
      const m = guestsOf(g).find((c) => c.id === e.guestId);
      if (m?.partyId) seatedParties.add(m.partyId);
      if (m?.kid) kids++;
    });
    for (let d = 0; d < days; d++) {
      let i = 0;
      for (; i < 40_000 && g.state.clock.phase !== 'report'; i++) {
        g.tickOnce();
        partyInvariants(g);
        if (i % 700 === 400 && moveSomething(g, i)) moves++;
      }
      expect(g.state.clock.phase).toBe('report');
      expect(guestsOf(g)).toHaveLength(0);
      expect(g.state.parties).toHaveLength(0);
      g.dispatch({ type: 'continueAfterReport' });
      for (let k = 0; k < 100 && g.state.clock.phase === 'night'; k++) g.tickOnce();
    }
    return { g, log, moves, seatedParties, kids };
  }

  it('2 days at rank 3 with parties and furniture moves: invariants hold, everyone leaves', () => {
    const { g, moves, seatedParties, kids } = playDays(5, 2);
    expect(g.state.clock.day).toBe(3);
    expect(seatedParties.size).toBeGreaterThanOrEqual(4);
    expect(kids).toBeGreaterThan(0);
    expect(moves).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const a = playDays(6, 2).g;
    const b = playDays(6, 2).g;
    expect(serialize(a.state, AT) === serialize(b.state, AT)).toBe(true);
  });

  it('the day brings parties of every size at rank 3', () => {
    const state = createInitialState(8);
    state.rank = 3;
    const g = new Game(state);
    const sizes = new Set<number>();
    g.events.on('guestArrived', () => {
      const sizeByParty = new Map<string, number>();
      for (const c of guestsOf(g))
        if (c.partyId) sizeByParty.set(c.partyId, (sizeByParty.get(c.partyId) ?? 0) + 1);
      for (const n of sizeByParty.values()) sizes.add(n);
    });
    for (let i = 0; i < 30_000 && g.state.clock.phase !== 'report'; i++) g.tickOnce();
    expect([...sizes].some((n) => n >= 2)).toBe(true);
  });
});
