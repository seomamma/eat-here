import { describe, expect, it } from 'vitest';
import { SELL_REFUND_RATE } from '../../src/data/balance';
import { FURNITURE, MAX_FURNITURE_LEVEL, type FurnitureDefId } from '../../src/data/furniture';
import { SHOP_CATEGORIES, SHOP_ITEMS, shopItemsOf, unlockRank } from '../../src/data/shop';
import { FLOOR_STYLES, WALL_STYLES } from '../../src/data/surfaces';
import { SURFACE_CAP } from '../../src/data/happiness';
import { isGuest } from '../../src/sim/characters';
import { ledgerTotal } from '../../src/sim/dayStats';
import { Game } from '../../src/sim/game';
import type { Furniture } from '../../src/sim/grid';
import { createInitialState, type GameState } from '../../src/sim/state';
import {
  findFreeSpot,
  isChairUsable,
  validateBuy as validateBuyAbs,
} from '../../src/sim/systems/build';
import { OX, OY, spawnSolo } from './helpers';
import {
  auraPoints,
  sellRefund,
  stationSpeed,
  upgradeCostOf,
  upgradeSpent,
  validateSell,
} from '../../src/sim/systems/facilities';
import { decorPoints, onSeated, seatComfort } from '../../src/sim/systems/happiness';
import { floorStyleAt, surfacePoints, wallSegmentIds } from '../../src/sim/systems/surfaces';

/** Coordinates in this file are in the pre-M12b local frame (room tiles 1..8 x 1..11). */
function validateBuy(
  s: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: 0 | 1 | 2 | 3,
) {
  return validateBuyAbs(s, defId, x + OX, y + OY, rot);
}

function put(
  state: GameState,
  defId: FurnitureDefId,
  x: number,
  y: number,
  rot: 0 | 1 | 2 | 3 = 0,
  level = 1,
): Furniture {
  const f: Furniture = {
    id: `t${state.furniture.length}x${x}y${y}`,
    defId,
    x: x + OX,
    y: y + OY,
    rot,
    level,
  };
  state.furniture.push(f);
  return f;
}

function idAt(state: GameState, x: number, y: number): string {
  const f = state.furniture.find((o) => o.x === x + OX && o.y === y + OY);
  if (!f) throw new Error(`no furniture at ${x},${y}`);
  return f.id;
}

function rich(seed = 1, rank = 6): Game {
  const g = new Game(createInitialState(seed));
  g.state.money = 100_000;
  g.state.rank = rank;
  return g;
}

describe('furniture catalog', () => {
  it('every def has 5 appeal values, 4 level-up costs and 5-entry effect arrays', () => {
    for (const [id, def] of Object.entries(FURNITURE)) {
      expect(def.appeal, id).toHaveLength(MAX_FURNITURE_LEVEL);
      expect(def.levelUpCost, id).toHaveLength(MAX_FURNITURE_LEVEL - 1);
      for (const arr of [def.comfort, def.speed, def.aura?.points, def.interaction?.points]) {
        if (arr) expect(arr, id).toHaveLength(MAX_FURNITURE_LEVEL);
      }
      if (def.interaction?.coins) expect(def.interaction.coins, id).toHaveLength(5);
      // Levels never make a piece worse.
      for (const arr of [def.appeal, def.comfort, def.aura?.points, def.interaction?.points]) {
        if (arr) expect([...arr], id).toEqual([...arr].sort((a, b) => a - b));
      }
      if (def.speed) expect([...def.speed], id).toEqual([...def.speed].sort((a, b) => b - a));
    }
  });

  it('shop items are grouped by category; the oven and pass are not for sale', () => {
    expect(SHOP_CATEGORIES).toEqual(['seating', 'fun', 'decor', 'kitchen']);
    expect(shopItemsOf('kitchen')).toEqual([]);
    expect(SHOP_ITEMS).not.toContain('oven_pizza');
    expect(SHOP_ITEMS).not.toContain('counter_pass');
    const all = SHOP_CATEGORIES.flatMap((c) => shopItemsOf(c));
    expect([...all].sort()).toEqual([...SHOP_ITEMS].sort());
    // Some items wait for Rank 2 and 3.
    expect(SHOP_ITEMS.map(unlockRank)).toContain(2);
    expect(SHOP_ITEMS.map(unlockRank)).toContain(3);
  });

  it('locked items cannot be bought', () => {
    const s = createInitialState(1);
    s.money = 10_000;
    expect(unlockRank('statue')).toBe(4);
    const r = validateBuy(s, 'statue', 7, 5, 0);
    expect(r).toEqual({ ok: false, reason: 'locked' });
    s.rank = 4;
    expect(validateBuy(s, 'statue', 7, 5, 0)).toEqual({ ok: true });
  });
});

describe('long table', () => {
  it('chairs on both long sides and both ends are usable (a chair faces any table tile)', () => {
    const s = createInitialState(1);
    s.furniture = [];
    put(s, 'table_long', 5, 5);
    const spots: [number, number, 0 | 1 | 2 | 3][] = [
      [5, 4, 0],
      [6, 4, 0],
      [5, 6, 2],
      [6, 6, 2],
      [4, 5, 1],
      [7, 5, 3],
    ];
    for (const [x, y, rot] of spots) {
      expect(
        isChairUsable(s, { id: 'c', defId: 'chair_cushion', x: x + OX, y: y + OY, rot, level: 1 }),
      ).toBe(true);
    }
    // Facing away from the table is not usable.
    expect(
      isChairUsable(s, { id: 'c', defId: 'chair_wood', x: 6 + OX, y: 4 + OY, rot: 2, level: 1 }),
    ).toBe(false);
  });
});

describe('upgradeFurniture', () => {
  it('costs levelUpCost[level - 1], raises the level and is booked as an upgrade', () => {
    const g = rich();
    const plantSpot = findFreeSpot(g.state, 'plant_potted');
    if (!plantSpot) throw new Error('no spot');
    g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...plantSpot, rot: 0 });
    const plant = g.state.furniture.find((f) => f.defId === 'plant_potted');
    if (!plant) throw new Error('no plant');
    const levels: number[] = [];
    g.events.on('furnitureLeveledUp', (e) => levels.push(e.level));
    let total = 0;
    for (let lv = 1; lv < MAX_FURNITURE_LEVEL; lv++) {
      const before = g.state.money;
      const cost = FURNITURE.plant_potted.levelUpCost[lv - 1] as number;
      expect(upgradeCostOf(plant)).toBe(cost);
      expect(g.dispatch({ type: 'upgradeFurniture', id: plant.id })).toEqual({ ok: true });
      expect(plant.level).toBe(lv + 1);
      expect(g.state.money).toBe(before - cost);
      total += cost;
    }
    expect(levels).toEqual([2, 3, 4, 5]);
    expect(upgradeSpent(plant)).toBe(total);
    expect(ledgerTotal(g.state.dayStats.ledger, 'upgrade')).toBe(-total);
    expect(g.state.dayStats.ledger.entries.filter((e) => e.kind === 'upgrade')[0]?.label).toBe(
      'plant_potted:2',
    );
  });

  it('is refused at max level, without money, for unknown ids and at night', () => {
    const g = rich();
    const oven = idAt(g.state, 2, 1);
    expect(g.dispatch({ type: 'upgradeFurniture', id: 'nope' })).toEqual({
      ok: false,
      reason: 'unknownFurniture',
    });
    g.state.money = 10;
    expect(g.dispatch({ type: 'upgradeFurniture', id: oven })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    expect(g.state.furniture.find((f) => f.id === oven)?.level).toBe(1);
    g.state.money = 100_000;
    g.state.furniture.find((f) => f.id === oven)!.level = 5;
    expect(g.dispatch({ type: 'upgradeFurniture', id: oven })).toEqual({
      ok: false,
      reason: 'maxLevel',
    });
    g.state.furniture.find((f) => f.id === oven)!.level = 1;
    g.state.clock.phase = 'night';
    expect(g.dispatch({ type: 'upgradeFurniture', id: oven })).toEqual({
      ok: false,
      reason: 'notNow',
    });
  });

  it('works while the restaurant is open and a guest is using the piece', () => {
    const g = rich();
    g.state.clock.phase = 'open';
    const chair = g.state.furniture.find((f) => f.defId === 'chair_wood');
    if (!chair) throw new Error('no chair');
    expect(g.dispatch({ type: 'upgradeFurniture', id: chair.id })).toEqual({ ok: true });
  });
});

describe('level effects', () => {
  it('appeal, comfort and speed are read at the piece level', () => {
    const s = createInitialState(1);
    s.furniture = [];
    const table = put(s, 'table_long', 5, 5, 0, 1);
    const chair = put(s, 'chair_cushion', 5, 4, 0, 1);
    expect(seatComfort(s.furniture, chair)).toBe(3 + 1);
    chair.level = 5;
    table.level = 5;
    expect(seatComfort(s.furniture, chair)).toBe(8 + 6);
    // Chair faces the second tile of the long table too.
    const chair2 = put(s, 'chair_wood', 6, 6, 2, 3);
    expect(seatComfort(s.furniture, chair2)).toBe(2 + 6);

    const near = put(s, 'plant_potted', 4, 4, 0, 2);
    expect(decorPoints(s.furniture, chair)).toBe(FURNITURE.plant_potted.appeal[1]);
    near.level = 4;
    expect(decorPoints(s.furniture, chair)).toBe(FURNITURE.plant_potted.appeal[3]);
  });

  it('oven level scales cook time (x1, 0.9, 0.8, 0.7, 0.6)', () => {
    const times: number[] = [];
    for (let level = 1; level <= 5; level++) {
      const g = new Game(createInitialState(3));
      const oven = g.state.furniture.find((f) => f.defId === 'oven_pizza');
      if (!oven) throw new Error('no oven');
      oven.level = level;
      expect(stationSpeed(g.state, 'oven')).toBe(FURNITURE.oven_pizza.speed?.[level - 1]);
      let timer = 0;
      for (let i = 0; i < 4000 && timer === 0; i++) {
        g.tickOnce();
        const cook = g.state.characters.find((c) => c.kind === 'staff' && c.action === 'cook');
        if (cook && cook.kind === 'staff') timer = cook.timer;
      }
      expect(timer).toBeGreaterThan(0);
      times.push(timer);
    }
    const base = times[0] as number;
    [1, 0.9, 0.8, 0.7, 0.6].forEach((k, i) => {
      expect(Math.abs((times[i] as number) - base * k), `level ${i + 1}`).toBeLessThanOrEqual(1.5);
    });
    expect(times[4]).toBeLessThan(times[0] as number);
  });
});

describe('aura', () => {
  it('piano gives "music" within radius 3, best source only, level by level', () => {
    const s = createInitialState(1);
    s.furniture = [];
    const chair = { x: 5 + OX, y: 8 + OY };
    const piano = put(s, 'piano', 5, 5, 0, 1); // covers (5,5) and (6,5); distance 3
    expect(auraPoints(s.furniture, chair, 'music')).toBe(4);
    piano.level = 5;
    expect(auraPoints(s.furniture, chair, 'music')).toBe(12);
    // A second, weaker piano does not add to the first.
    put(s, 'piano', 5, 6, 0, 1);
    expect(auraPoints(s.furniture, chair, 'music')).toBe(12);
    // Out of range.
    expect(auraPoints(s.furniture, { x: 5 + OX, y: 9 + OY }, 'music')).toBe(4);
    expect(auraPoints(s.furniture, { x: 1 + OX, y: 11 + OY }, 'music')).toBe(0);
    expect(auraPoints(s.furniture, chair, 'toilet')).toBe(0);
  });

  it('a guest seated near a piano gets the "Lovely music" reason once', () => {
    const state = createInitialState(1);
    state.guestSpawn.enabled = true;
    state.guestSpawn.nextInTicks = 1;
    const guest = spawnSolo(state);
    const chair = state.furniture.find((f) => f.defId === 'chair_wood') as Furniture;
    guest.seatId = chair.id;
    put(state, 'piano', 4, 8, 0, 3);
    onSeated(state, guest);
    const music = guest.happinessLog.filter((e) => e.reason === 'music');
    expect(music).toEqual([{ reason: 'music', points: 8 }]);
  });
});

describe('sellFurniture', () => {
  it('refunds half the price plus half of the upgrade coins and books a sale', () => {
    const g = rich();
    const spot = findFreeSpot(g.state, 'statue');
    if (!spot) throw new Error('no spot');
    g.dispatch({ type: 'buyAndPlace', defId: 'statue', ...spot, rot: 0 });
    const statue = g.state.furniture.find((f) => f.defId === 'statue') as Furniture;
    g.dispatch({ type: 'upgradeFurniture', id: statue.id });
    g.dispatch({ type: 'upgradeFurniture', id: statue.id });
    const spent = FURNITURE.statue.levelUpCost[0] + FURNITURE.statue.levelUpCost[1];
    expect(upgradeSpent(statue)).toBe(spent);
    const expected = Math.floor((FURNITURE.statue.price + spent) * SELL_REFUND_RATE);
    expect(sellRefund(statue)).toBe(expected);
    const before = g.state.money;
    const sold: number[] = [];
    g.events.on('furnitureSold', (e) => sold.push(e.refund));
    expect(g.dispatch({ type: 'sellFurniture', id: statue.id })).toEqual({ ok: true });
    expect(g.state.money).toBe(before + expected);
    expect(g.state.furniture.some((f) => f.id === statue.id)).toBe(false);
    expect(sold).toEqual([expected]);
    const entry = g.state.dayStats.ledger.entries.find((e) => e.kind === 'sale');
    expect(entry).toMatchObject({ amount: expected, label: 'statue' });
    expect(entry?.amount).toBeGreaterThan(0);
  });

  it('the walk grid is rebuilt: the tile is free again', () => {
    const g = rich();
    const spot = findFreeSpot(g.state, 'plant_potted');
    if (!spot) throw new Error('no spot');
    g.dispatch({ type: 'buyAndPlace', defId: 'plant_potted', ...spot, rot: 0 });
    const plant = g.state.furniture.find((f) => f.defId === 'plant_potted') as Furniture;
    g.dispatch({ type: 'sellFurniture', id: plant.id });
    expect(validateBuyAbs(g.state, 'plant_potted', spot.x, spot.y, 0)).toEqual({ ok: true });
  });

  it('is refused for a piece in use, the last oven or pass, unknown ids and at night', () => {
    const g = rich();
    const { state } = g;
    const oven = idAt(state, 2, 1);
    const pass = idAt(state, 5, 3);
    expect(validateSell(state, oven)).toEqual({ ok: false, reason: 'lastRequired' });
    expect(g.dispatch({ type: 'sellFurniture', id: pass })).toEqual({
      ok: false,
      reason: 'lastRequired',
    });
    expect(g.dispatch({ type: 'sellFurniture', id: 'nope' })).toEqual({
      ok: false,
      reason: 'unknownFurniture',
    });
    // A second oven makes the first one sellable.
    put(state, 'oven_pizza', 6, 1);
    expect(validateSell(state, oven).ok).toBe(true);
    // A chair a guest has claimed cannot be sold.
    const chair = state.furniture.find((f) => f.defId === 'chair_wood') as Furniture;
    state.guestSpawn.enabled = true;
    state.guestSpawn.nextInTicks = 1;
    const guest = spawnSolo(state);
    state.characters.push(guest);
    guest.seatId = chair.id;
    expect(g.dispatch({ type: 'sellFurniture', id: chair.id })).toEqual({
      ok: false,
      reason: 'inUse',
    });
    const money = state.money;
    expect(state.furniture.some((f) => f.id === chair.id)).toBe(true);
    expect(state.money).toBe(money);
    state.clock.phase = 'night';
    expect(validateSell(state, idAt(state, 3, 6))).toEqual({ ok: false, reason: 'notNow' });
  });

  it('a vending machine or toilet a guest is walking to cannot be sold', () => {
    const g = rich();
    const { state } = g;
    const vend = put(state, 'vending_machine', 7, 5);
    state.characters.push({
      ...(spawnSolo(state)),
      errand: { kind: 'vending', furnitureId: vend.id, stage: 'walking', timer: 0 },
    });
    expect(validateSell(state, vend.id)).toEqual({ ok: false, reason: 'inUse' });
  });
});

describe('floors and walls', () => {
  it('paintFloor charges per changed tile, updates styles and books it', () => {
    const g = rich(1, 3);
    const tiles = [
      { x: 3 + OX, y: 5 + OY },
      { x: 4 + OX, y: 5 + OY },
      { x: 4 + OX, y: 5 + OY },
    ];
    const before = g.state.money;
    const done: number[] = [];
    g.events.on('surfacePainted', (e) => done.push(e.cost));
    expect(g.dispatch({ type: 'paintFloor', tiles, style: 'terracotta' })).toEqual({ ok: true });
    const cost = 2 * FLOOR_STYLES.terracotta.price;
    expect(g.state.money).toBe(before - cost);
    expect(done).toEqual([cost]);
    expect(floorStyleAt(g.state, 3 + OX, 5 + OY)).toBe('terracotta');
    expect(floorStyleAt(g.state, 5 + OX, 5 + OY)).toBe('wood');
    expect(floorStyleAt(g.state, 4 + OX, 2 + OY)).toBe('checker');
    const entry = g.state.dayStats.ledger.entries.find((e) => e.kind === 'furniture');
    expect(entry).toMatchObject({ amount: -cost, count: 2, label: 'floor:terracotta' });
    // Painting a tile back to its default leaves no override behind.
    g.dispatch({ type: 'paintFloor', tiles: [{ x: 3 + OX, y: 5 + OY }], style: 'wood' });
    expect(g.state.styles.floor[`${3 + OX},${5 + OY}`]).toBeUndefined();
    // Painting the same style again is refused (nothing to pay for).
    expect(
      g.dispatch({ type: 'paintFloor', tiles: [{ x: 4 + OX, y: 5 + OY }], style: 'terracotta' }),
    ).toEqual({
      ok: false,
      reason: 'noChange',
    });
  });

  it('refuses without enough money, for locked styles, walls and night; nothing is charged', () => {
    const g = rich(1, 1);
    const tiles = [{ x: 3 + OX, y: 5 + OY }];
    expect(g.dispatch({ type: 'paintFloor', tiles, style: 'herringbone' })).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(g.dispatch({ type: 'paintFloor', tiles, style: 'terracotta' })).toEqual({
      ok: false,
      reason: 'locked',
    });
    g.state.rank = 2;
    expect(
      g.dispatch({ type: 'paintFloor', tiles: [{ x: 0 + OX, y: 5 + OY }], style: 'terracotta' }),
    ).toEqual({
      ok: false,
      reason: 'notFloor',
    });
    g.state.money = FLOOR_STYLES.terracotta.price * 2 - 1;
    const stroke = [
      { x: 3 + OX, y: 5 + OY },
      { x: 4 + OX, y: 5 + OY },
    ];
    expect(g.dispatch({ type: 'paintFloor', tiles: stroke, style: 'terracotta' })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    expect(g.state.money).toBe(FLOOR_STYLES.terracotta.price * 2 - 1);
    expect(g.state.styles.floor).toEqual({});
    g.state.money = 1000;
    g.state.clock.phase = 'night';
    expect(g.dispatch({ type: 'paintFloor', tiles, style: 'terracotta' })).toEqual({
      ok: false,
      reason: 'notNow',
    });
  });

  it('paintWall paints segments of the back walls', () => {
    const g = rich(1, 3);
    const ids = wallSegmentIds(g.state.room);
    const [l1, l2, r3, r4, r8, r9] = [
      `l${1 + OY}`,
      `l${2 + OY}`,
      `r${3 + OX}`,
      `r${4 + OX}`,
      `r${8 + OX}`,
      `r${9 + OX}`,
    ];
    expect(ids).toContain(l1);
    expect(ids).toContain(r8);
    expect(ids).not.toContain(r9);
    const before = g.state.money;
    expect(g.dispatch({ type: 'paintWall', segments: [l2, r3, r4], style: 'brick' })).toEqual({
      ok: true,
    });
    expect(g.state.money).toBe(before - 3 * WALL_STYLES.brick.price);
    expect(g.state.styles.wall).toEqual({ [l2]: 'brick', [r3]: 'brick', [r4]: 'brick' });
    expect(g.dispatch({ type: 'paintWall', segments: ['x9'], style: 'brick' })).toEqual({
      ok: false,
      reason: 'unknownSegment',
    });
    g.state.rank = 1;
    expect(
      g.dispatch({ type: 'paintWall', segments: [`l${5 + OY}`], style: 'blue_tiles' }),
    ).toEqual({
      ok: false,
      reason: 'locked',
    });
  });

  it('surface appeal counts floors near a chair and walls, capped, inside the decor cap', () => {
    const s = createInitialState(1);
    s.furniture = [];
    const chair = put(s, 'chair_wood', 5, 5);
    expect(surfacePoints(s, chair)).toBe(0);
    const fk = (x: number, y: number) => `${x + OX},${y + OY}`;
    s.styles.floor[fk(5, 5)] = 'terracotta';
    s.styles.floor[fk(6, 5)] = 'terracotta';
    expect(surfacePoints(s, chair)).toBe(2 * FLOOR_STYLES.terracotta.appeal);
    s.styles.floor[fk(4, 5)] = 'herringbone'; // not 1 tile away from nothing: adjacent, counts
    for (const [x, y] of [
      [4, 4],
      [5, 4],
      [6, 4],
      [4, 6],
      [5, 6],
      [6, 6],
    ] as const)
      s.styles.floor[fk(x, y)] = 'herringbone';
    expect(surfacePoints(s, chair)).toBe(SURFACE_CAP);
    // Far from the chair: nothing.
    expect(surfacePoints(s, { x: 8 + OX, y: 10 + OY })).toBe(0);
    // Walls near the chair add up to the same cap and count in decor points.
    const chair2 = { ...chair, x: 2 + OX, y: 3 + OY };
    s.styles.wall = { [`l${3 + OY}`]: 'brick', [`l${4 + OY}`]: 'brick', [`r${2 + OX}`]: 'brick' };
    expect(surfacePoints(s, chair2)).toBe(3 * WALL_STYLES.brick.appeal);
    expect(decorPoints(s.furniture, chair2, s)).toBe(3);
    put(s, 'statue', 3, 3, 0, 5);
    expect(decorPoints(s.furniture, chair2, s)).toBeLessThanOrEqual(20);
  });
});

describe('all guests', () => {
  it('no guest object lacks the new fields', () => {
    const g = new Game(createInitialState(2));
    for (let i = 0; i < 600; i++) g.tickOnce();
    for (const c of g.state.characters.filter(isGuest)) {
      expect(c.errand).toBeNull();
      expect(c.snackAsked).toBe(false);
    }
  });
});
