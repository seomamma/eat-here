import { afterEach, describe, expect, it } from 'vitest';
import { FURNITURE, type FurnitureDefId } from '../../src/data/furniture';
import { isGuest, type Guest } from '../../src/sim/characters';
import { ledgerTotal } from '../../src/sim/dayStats';
import { Game } from '../../src/sim/game';
import type { Furniture } from '../../src/sim/grid';
import { serialize } from '../../src/sim/save';
import { createInitialState, type GameState } from '../../src/sim/state';
import { validatePlacement } from '../../src/sim/systems/build';
import { OX, OY, openGame } from './helpers';

const AT = 1_700_000_000_000;

function put(
  state: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  level = 1,
  rot: 0 | 1 | 2 | 3 = 0,
): Furniture {
  // Coordinates are in the pre-M12b local frame (shifted by OX/OY).
  const f: Furniture = { id: `t${x}_${y}`, defId, x: x + OX, y: y + OY, rot, level };
  expect(validatePlacement(state, defId, x + OX, y + OY, rot).ok, `${defId} at ${x},${y}`).toBe(
    true,
  );
  state.furniture.push(f);
  return f;
}

const guestsOf = (g: Game): Guest[] => g.state.characters.filter(isGuest);

/** Checked after every tick: seats and machines each have at most one user. */
function invariants(g: Game): void {
  const seats = new Set<string>();
  const machines = new Set<string>();
  for (const c of guestsOf(g)) {
    if (c.seatId) {
      expect(seats.has(c.seatId), `seat ${c.seatId}`).toBe(false);
      seats.add(c.seatId);
    }
    if (c.errand) {
      expect(machines.has(c.errand.furnitureId), `machine ${c.errand.furnitureId}`).toBe(false);
      machines.add(c.errand.furnitureId);
      expect(g.state.furniture.some((f) => f.id === c.errand?.furnitureId)).toBe(true);
      if (c.errand.kind === 'vending') expect(c.phase).toBe('waitingForSeat');
      else expect(c.phase).toBe('toilet');
    }
    if (c.phase === 'toilet') expect(c.errand?.kind).toBe('toilet');
  }
}

/** A room without chairs: every guest has to wait. */
function noSeats(g: Game): void {
  g.state.furniture = g.state.furniture.filter((f) => FURNITURE[f.defId].kind !== 'chair');
  g.invalidateWalkGrid();
}

const original = {
  vending: FURNITURE.vending_machine.interaction?.chance ?? 0,
  toilet: FURNITURE.toilet.interaction?.chance ?? 0,
};
afterEach(() => {
  const v = FURNITURE.vending_machine.interaction;
  const t = FURNITURE.toilet.interaction;
  if (v) v.chance = original.vending;
  if (t) t.chance = original.toilet;
});

function setChance(vending: number, toilet: number): void {
  const v = FURNITURE.vending_machine.interaction;
  const t = FURNITURE.toilet.interaction;
  if (v) v.chance = vending;
  if (t) t.chance = toilet;
}

describe('vending machine', () => {
  it('a guest waiting for a seat walks to it, pays coins, gets "Snack while waiting" and walks back', () => {
    setChance(1, 0);
    const g = openGame(3);
    noSeats(g);
    const vm = put(g.state, 'vending_machine', 8, 5, 3);
    const done: { coins: number }[] = [];
    g.events.on('errandDone', (e) => done.push(e));
    const money: number[] = [];
    g.events.on('errandDone', () => money.push(g.state.money));
    let sawUsing = false;
    for (let i = 0; i < 900 && done.length === 0; i++) {
      g.tickOnce();
      invariants(g);
      const user = guestsOf(g).find((c) => c.errand?.stage === 'using');
      if (user) {
        sawUsing = true;
        // The guest stands at the machine's use spot (in front of it).
        expect(Math.round(user.x)).toBe(vm.x);
        expect(Math.round(user.y)).toBe(vm.y + 1);
      }
    }
    expect(sawUsing).toBe(true);
    expect(done).toHaveLength(1);
    const coins = FURNITURE.vending_machine.interaction?.coins?.[2] as number;
    expect(done[0]?.coins).toBe(coins);
    const guest = guestsOf(g).find((c) => c.happinessLog.some((e) => e.reason === 'snack'));
    expect(guest?.happinessLog.find((e) => e.reason === 'snack')?.points).toBe(
      FURNITURE.vending_machine.interaction?.points[2],
    );
    expect(guest?.errand).toBeNull();
    // Booked as vending income, counted in the day's income.
    expect(ledgerTotal(g.state.dayStats.ledger, 'vending')).toBe(coins);
    expect(g.state.dayStats.income).toBeGreaterThanOrEqual(coins);
    // The guest returns to the waiting spot.
    for (let i = 0; i < 60; i++) g.tickOnce();
    const back = guestsOf(g).find((c) => c.id === guest?.id);
    if (back && back.phase === 'waitingForSeat' && back.waitSpot) {
      expect(Math.round(back.x)).toBe(back.waitSpot.x);
      expect(Math.round(back.y)).toBe(back.waitSpot.y);
    }
  });

  it('only one guest uses a machine at a time, and each guest only tries once', () => {
    setChance(1, 0);
    const g = openGame(4);
    noSeats(g);
    put(g.state, 'vending_machine', 8, 5);
    const used = new Map<string, number>();
    g.events.on('errandDone', (e) => used.set(e.guestId, (used.get(e.guestId) ?? 0) + 1));
    let overlapSeen = false;
    for (let i = 0; i < 2400; i++) {
      g.tickOnce();
      invariants(g);
      const busy = guestsOf(g).filter((c) => c.errand);
      if (busy.length > 1) overlapSeen = true;
    }
    expect(overlapSeen).toBe(false);
    expect(used.size).toBeGreaterThan(2);
    for (const n of used.values()) expect(n).toBe(1);
  });

  it('a free seat beats the snack: the guest drops the errand and frees the machine', () => {
    setChance(1, 0);
    const g = openGame(5);
    noSeats(g);
    put(g.state, 'vending_machine', 8, 5);
    let guest: Guest | undefined;
    for (let i = 0; i < 600 && !guest; i++) {
      g.tickOnce();
      guest = guestsOf(g).find((c) => c.errand?.stage === 'walking');
    }
    expect(guest).toBeDefined();
    // A table with a chair appears while the guest is on the way.
    g.state.furniture.push(
      { id: 'tb', defId: 'table_small', x: 6, y: 7, rot: 0, level: 1 },
      { id: 'ch', defId: 'chair_wood', x: 5, y: 7, rot: 1, level: 1 },
    );
    g.invalidateWalkGrid();
    g.tickOnce();
    expect(guest?.errand).toBeNull();
    expect(guest?.seatId).toBe('ch');
    expect(guest?.phase).toBe('walkingToSeat');
    invariants(g);
  });

  it('does nothing without a machine, and guests who found no machine free do not roll', () => {
    setChance(1, 0);
    const g = openGame(6);
    noSeats(g);
    for (let i = 0; i < 600; i++) g.tickOnce();
    expect(guestsOf(g).every((c) => c.errand === null && !c.snackAsked)).toBe(true);
  });

  it('can only be placed where its use spot stays reachable', () => {
    const s = createInitialState(1);
    s.furniture = [];
    s.furniture.push({
      id: 'v',
      defId: 'vending_machine',
      x: 8 + OX,
      y: 5 + OY,
      rot: 0,
      level: 1,
    });
    // The spot in front of the machine is (8, 6): blocking it is refused.
    expect(validatePlacement(s, 'plant_potted', 8 + OX, 6 + OY, 0)).toEqual({
      ok: false,
      reason: 'blocksWay',
    });
    // A machine whose spot would be outside the room is refused too.
    expect(validatePlacement(s, 'toilet', 1 + OX, 11 + OY, 0)).toEqual({
      ok: false,
      reason: 'blocksWay',
    });
    expect(validatePlacement(s, 'toilet', 1 + OX, 9 + OY, 0).ok).toBe(true);
  });
});

describe('toilet', () => {
  it('after eating a guest visits it, gets "Clean toilet" by level and then pays', () => {
    setChance(0, 1);
    const g = openGame(7);
    const toilet = put(g.state, 'toilet', 1, 8, 4);
    const log: string[] = [];
    g.events.on('errandDone', (e) => log.push(`done:${e.kind}`));
    g.events.on('paid', () => log.push('paid'));
    let sawToiletPhase = false;
    for (let i = 0; i < 2400 && log.filter((l) => l === 'paid').length < 3; i++) {
      g.tickOnce();
      invariants(g);
      for (const c of guestsOf(g)) {
        if (c.phase === 'toilet') {
          sawToiletPhase = true;
          const t = g.state.furniture.find((f) => f.id === toilet.id) as Furniture;
          if (c.errand?.stage === 'using') {
            expect(Math.round(c.x)).toBe(t.x);
            expect(Math.round(c.y)).toBe(t.y + 1);
          }
        }
      }
    }
    expect(sawToiletPhase).toBe(true);
    // Each visit finishes before the payment of the same guest.
    expect(log.slice(0, 2)).toEqual(['done:toilet', 'paid']);
    const visited = guestsOf(g).filter((c) => c.happinessLog.some((e) => e.reason === 'toilet'));
    for (const c of visited) {
      expect(c.happinessLog.find((e) => e.reason === 'toilet')?.points).toBe(
        FURNITURE.toilet.interaction?.points[3],
      );
    }
  });

  it('without a toilet, or when the dice say no, nobody goes', () => {
    setChance(0, 0);
    const g = openGame(8);
    put(g.state, 'toilet', 1, 8);
    const kinds: string[] = [];
    g.events.on('errandDone', (e) => kinds.push(e.kind));
    for (let i = 0; i < 1500; i++) g.tickOnce();
    expect(kinds).toEqual([]);
    const h = openGame(8);
    for (let i = 0; i < 1500; i++) h.tickOnce();
    expect(guestsOf(h).some((c) => c.phase === 'toilet')).toBe(false);
  });

  it('a busy toilet is skipped: one user at a time, nobody waits for it', () => {
    setChance(0, 1);
    const g = openGame(9);
    put(g.state, 'toilet', 1, 8);
    let visits = 0;
    g.events.on('errandDone', () => visits++);
    for (let i = 0; i < 3000; i++) {
      g.tickOnce();
      invariants(g);
    }
    expect(visits).toBeGreaterThan(2);
  });
});

describe('days with vending machine and toilet', () => {
  /** Three seeded days, many guests: everyone leaves by every report, no double claims. */
  for (const seed of [11, 12, 13]) {
    it(`seed ${seed}: everyone leaves by the report; claims stay unique; no one is stranded`, () => {
      setChance(0.7, 0.6);
      const g = new Game(createInitialState(seed));
      // Rank 6 for the busiest arrivals, so guests regularly wait for a seat and snack.
      g.state.rank = 6;
      // Only four seats, so guests regularly wait for a seat and snack.
      put(g.state, 'vending_machine', 8, 5, 2);
      put(g.state, 'toilet', 1, 8, 2);
      put(g.state, 'piano', 7, 9, 2);
      let reports = 0;
      let snacks = 0;
      let visits = 0;
      g.events.on('errandDone', (e) => (e.kind === 'vending' ? snacks++ : visits++));
      let paid = 0;
      g.events.on('paid', () => paid++);
      const arrived = new Set<string>();
      g.events.on('guestArrived', (e) => arrived.add(e.guestId));
      const left = new Set<string>();
      g.events.on('guestLeft', (e) => left.add(e.guestId));
      for (let i = 0; i < 40_000 && reports < 3; i++) {
        if (g.state.clock.phase === 'report') {
          reports++;
          // The report only appears when nobody is left in the room.
          expect(guestsOf(g)).toHaveLength(0);
          expect(arrived.size).toBe(left.size);
          g.dispatch({ type: 'continueAfterReport' });
        }
        g.tickOnce();
        invariants(g);
      }
      expect(reports).toBe(3);
      expect(snacks).toBeGreaterThan(0);
      expect(visits).toBeGreaterThan(0);
      expect(paid).toBeGreaterThan(20);
    });
  }

  it('a machine a guest uses cannot be sold, but can be moved', () => {
    setChance(1, 0);
    const g = openGame(14);
    g.state.rank = 3;
    noSeats(g);
    const vm = put(g.state, 'vending_machine', 8, 5);
    let busy: Guest | undefined;
    for (let i = 0; i < 600 && !busy; i++) {
      g.tickOnce();
      busy = guestsOf(g).find((c) => c.errand?.stage === 'using');
    }
    expect(busy).toBeDefined();
    expect(g.dispatch({ type: 'sellFurniture', id: vm.id })).toEqual({
      ok: false,
      reason: 'inUse',
    });
    // Moving is allowed: the user is carried along (see relocate.test.ts).
    expect(g.dispatch({ type: 'moveFurniture', id: vm.id, x: 7 + OX, y: 5 + OY, rot: 0 })).toEqual({
      ok: true,
    });
  });

  it('is deterministic: the same seed and commands give the same game', () => {
    setChance(0.7, 0.5);
    const run = (): string => {
      const g = new Game(createInitialState(21));
      g.state.rank = 3;
      g.state.money = 5000;
      put(g.state, 'vending_machine', 8, 5);
      put(g.state, 'toilet', 1, 8);
      for (let i = 0; i < 3000; i++) {
        if (i === 1000) g.dispatch({ type: 'upgradeFurniture', id: 't8_5' });
        if (i === 1500)
          g.dispatch({ type: 'paintFloor', tiles: [{ x: 4, y: 7 }], style: 'terracotta' });
        g.tickOnce();
      }
      return serialize(g.state, AT);
    };
    expect(run()).toBe(run());
  });
});
