import { describe, expect, it } from 'vitest';
import {
  GIFT_CHANCE,
  GIFT_MIN_HAPPINESS,
  MARKET_PRICE,
  MARKET_SLOTS,
  MAX_RECIPE_LEVEL_MVP,
} from '../../src/data/balance';
import {
  INGREDIENTS,
  INGREDIENT_IDS,
  RARE_INGREDIENTS,
  type IngredientId,
} from '../../src/data/ingredients';
import { RANKS } from '../../src/data/ranks';
import { RECIPES, RECIPE_IDS } from '../../src/data/recipes';
import { isGuest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { createInitialState } from '../../src/sim/state';
import { findFreeSpot } from '../../src/sim/systems/build';
import { addFame } from '../../src/sim/systems/fame';
import { rollGift, rollMarket } from '../../src/sim/systems/market';
import { priceAtLevel } from '../../src/sim/systems/recipes';
import { qualityPoints } from '../../src/sim/systems/happiness';

function game(seed = 1): Game {
  return new Game(createInitialState(seed));
}

/** Plays one open day to the report and returns what happened. */
function playDay(g: Game) {
  const paid: { recipeId: string | null; price: number; happiness: number }[] = [];
  g.events.on('paid', (e) => {
    const c = g.state.characters.find((x) => x.id === e.guestId);
    if (c && isGuest(c))
      paid.push({ recipeId: c.recipeId, price: e.price, happiness: c.happiness });
  });
  for (let i = 0; i < 6000 && g.state.clock.phase !== 'report'; i++) g.tickOnce();
  return paid;
}

function nextDay(g: Game): void {
  g.dispatch({ type: 'continueAfterReport' });
  for (let i = 0; i < 200 && g.state.clock.phase === 'night'; i++) g.tickOnce();
}

describe('ingredient and recipe data', () => {
  it('has 8 ingredients (4 common, 4 rare) and every dish upgrades to Lv.3', () => {
    expect(INGREDIENT_IDS).toHaveLength(8);
    expect(RARE_INGREDIENTS).toHaveLength(4);
    for (const id of RECIPE_IDS) {
      const ups = RECIPES[id].upgrades;
      expect(ups.map((u) => u.level)).toEqual([2, MAX_RECIPE_LEVEL_MVP]);
      expect(INGREDIENTS[ups[0]?.ingredient ?? 'oregano'].rarity).toBe('common');
      expect(INGREDIENTS[ups[1]?.ingredient ?? 'oregano'].rarity).toBe('rare');
    }
  });
});

describe('upgradeRecipe', () => {
  it('spends the ingredient and coins, raises the level and emits recipeLeveledUp', () => {
    const g = game();
    const events: { recipeId: string; level: number }[] = [];
    g.events.on('recipeLeveledUp', (e) => events.push(e));
    g.state.inventory.fresh_basil = 1;
    g.state.money = 500;
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'margherita' })).toEqual({ ok: true });
    expect(g.state.recipes.margherita.level).toBe(2);
    expect(g.state.inventory.fresh_basil).toBe(0);
    expect(g.state.money).toBe(500 - 80);
    expect(events).toEqual([{ recipeId: 'margherita', level: 2 }]);

    g.state.inventory.buffalo_mozzarella = 1;
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'margherita' })).toEqual({ ok: true });
    expect(g.state.recipes.margherita.level).toBe(3);
    expect(g.state.money).toBe(500 - 80 - 200);
    expect(events.at(-1)).toEqual({ recipeId: 'margherita', level: 3 });
  });

  it('every dish can go Lv.1 -> 3 with its two ingredients', () => {
    for (const id of RECIPE_IDS) {
      const g = game();
      g.state.recipes[id].unlocked = true;
      g.state.money = 1000;
      for (const u of RECIPES[id].upgrades) g.state.inventory[u.ingredient] = 1;
      expect(g.dispatch({ type: 'upgradeRecipe', recipeId: id })).toEqual({ ok: true });
      expect(g.dispatch({ type: 'upgradeRecipe', recipeId: id })).toEqual({ ok: true });
      expect(g.state.recipes[id].level).toBe(3);
    }
  });

  it('refuses with a clear reason and changes nothing', () => {
    const g = game();
    g.state.money = 1000;
    const before = JSON.stringify(g.state.inventory);
    // missing ingredient
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' })).toEqual({
      ok: false,
      reason: 'missingIngredient',
    });
    // not enough coins
    g.state.inventory.oregano = 1;
    g.state.money = 79;
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    expect(g.state.money).toBe(79);
    expect(g.state.recipes.marinara.level).toBe(1);
    // locked
    g.state.inventory.chili_flakes = 1;
    g.state.money = 1000;
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'pepperoni' })).toEqual({
      ok: false,
      reason: 'locked',
    });
    // max level
    g.state.recipes.marinara.level = 3;
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' })).toEqual({
      ok: false,
      reason: 'maxLevel',
    });
    expect(g.state.inventory.oregano).toBe(1);
    expect(before).toContain('"oregano":0');
  });

  it('is refused at night with notNow, but allowed in the report phase', () => {
    const g = game();
    g.state.inventory.oregano = 1;
    g.state.money = 500;
    g.state.clock.phase = 'night';
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' })).toEqual({
      ok: false,
      reason: 'notNow',
    });
    g.state.clock.phase = 'report';
    expect(g.dispatch({ type: 'upgradeRecipe', recipeId: 'marinara' })).toEqual({ ok: true });
  });
});

describe('level effects', () => {
  it('price rises 15 % per level (rounded) and quality +5 per level', () => {
    expect(priceAtLevel('margherita', 1)).toBe(10);
    expect(priceAtLevel('margherita', 2)).toBe(12);
    expect(priceAtLevel('margherita', 3)).toBe(13);
    for (const id of RECIPE_IDS) {
      expect(priceAtLevel(id, 1)).toBe(RECIPES[id].price);
      expect(priceAtLevel(id, 2)).toBeGreaterThan(priceAtLevel(id, 1));
      expect(priceAtLevel(id, 3)).toBeGreaterThan(priceAtLevel(id, 2));
    }
    expect(qualityPoints(2) - qualityPoints(1)).toBe(5);
    expect(qualityPoints(3) - qualityPoints(2)).toBe(5);
  });

  it('guests pay the new price and are happier after an upgrade (seeded day)', () => {
    const base = game(4);
    const basePaid = playDay(base);
    expect(basePaid.every((p) => p.price === RECIPES[p.recipeId as 'marinara'].price)).toBe(true);

    const up = game(4);
    for (const id of RECIPE_IDS) up.state.recipes[id].level = 3;
    const upPaid = playDay(up);
    expect(upPaid.length).toBeGreaterThan(5);
    for (const p of upPaid) expect(p.price).toBe(priceAtLevel(p.recipeId as 'marinara', 3));
    const avg = (xs: { happiness: number }[]) =>
      xs.reduce((a, p) => a + p.happiness, 0) / xs.length;
    expect(avg(upPaid)).toBeGreaterThan(avg(basePaid) + 8);
    expect(up.state.dayStats.income).toBeGreaterThan(base.state.dayStats.income);
  });
});

describe('market', () => {
  it('starts with MARKET_SLOTS offers inside the price ranges', () => {
    const g = game(7);
    expect(g.state.market.day).toBe(1);
    expect(g.state.market.offers).toHaveLength(MARKET_SLOTS);
    for (const o of g.state.market.offers) {
      const [min, max] = MARKET_PRICE[INGREDIENTS[o.ingredient].rarity];
      expect(o.price).toBeGreaterThanOrEqual(min);
      expect(o.price).toBeLessThanOrEqual(max);
      expect(o.bought).toBe(false);
    }
    expect(new Set(g.state.market.offers.map((o) => o.ingredient)).size).toBe(MARKET_SLOTS);
  });

  it('is deterministic per seed and changes from day to day', () => {
    expect(game(7).state.market).toEqual(game(7).state.market);
    const a = game(7);
    const b = game(7);
    const days: string[] = [JSON.stringify(a.state.market.offers)];
    const refreshed: number[] = [];
    a.events.on('marketRefreshed', (e) => refreshed.push(e.day));
    for (let d = 0; d < 4; d++) {
      playDay(a);
      nextDay(a);
      days.push(JSON.stringify(a.state.market.offers));
    }
    for (let d = 0; d < 4; d++) {
      playDay(b);
      nextDay(b);
    }
    expect(a.state.market).toEqual(b.state.market);
    expect(a.state.market.day).toBe(5);
    expect(refreshed).toEqual([2, 3, 4, 5]);
    expect(new Set(days).size).toBeGreaterThan(1);
    // Different seeds give different markets in at least one of several seeds.
    const seeds = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(game(s).state.market)));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('rare offers show up now and then, priced above commons', () => {
    const s = createInitialState(11);
    let rare = 0;
    let offers = 0;
    for (let d = 0; d < 300; d++) {
      for (const o of rollMarket(s, d).offers) {
        offers++;
        if (INGREDIENTS[o.ingredient].rarity === 'rare') rare++;
      }
    }
    expect(rare / offers).toBeGreaterThan(0.12);
    expect(rare / offers).toBeLessThan(0.28);
  });

  it('an offer can be bought once; refusals have reasons', () => {
    const g = game(7);
    const offer = g.state.market.offers[0];
    if (!offer) throw new Error('no offer');
    g.state.money = offer.price - 1;
    expect(g.dispatch({ type: 'buyMarketOffer', index: 0 })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    expect(g.dispatch({ type: 'buyMarketOffer', index: 9 })).toMatchObject({ ok: false });
    g.state.money = offer.price + 5;
    const inv: string[] = [];
    g.events.on('inventoryChanged', (e) => inv.push(e.ingredient));
    expect(g.dispatch({ type: 'buyMarketOffer', index: 0 })).toEqual({ ok: true });
    expect(g.state.money).toBe(5);
    expect(g.state.inventory[offer.ingredient]).toBe(1);
    expect(offer.bought).toBe(true);
    expect(inv).toEqual([offer.ingredient]);
    g.state.money = 1000;
    expect(g.dispatch({ type: 'buyMarketOffer', index: 0 })).toEqual({
      ok: false,
      reason: 'alreadyBought',
    });
    expect(g.state.inventory[offer.ingredient]).toBe(1);
    g.state.clock.phase = 'night';
    expect(g.dispatch({ type: 'buyMarketOffer', index: 1 })).toEqual({
      ok: false,
      reason: 'notNow',
    });
  });
});

describe('gifts', () => {
  const guest = (happiness: number) => ({ id: 'g1', name: 'Nora', happiness });

  it('never below the happiness threshold and without drawing random numbers', () => {
    const g = game(3);
    const rng = g.state.rng;
    const gifts: unknown[] = [];
    g.events.on('giftReceived', (e) => gifts.push(e));
    for (let i = 0; i < 500; i++) rollGift(g.state, g.events, guest(GIFT_MIN_HAPPINESS - 1));
    expect(gifts).toHaveLength(0);
    expect(g.state.rng).toBe(rng);
    expect(Object.values(g.state.inventory).every((n) => n === 0)).toBe(true);
  });

  it('above the threshold they happen at about GIFT_CHANCE, with rares among them', () => {
    const g = game(3);
    const got: string[] = [];
    g.events.on('giftReceived', (e) => got.push(e.ingredient));
    const n = 5000;
    for (let i = 0; i < n; i++) rollGift(g.state, g.events, guest(GIFT_MIN_HAPPINESS));
    expect(got.length / n).toBeGreaterThan(GIFT_CHANCE - 0.03);
    expect(got.length / n).toBeLessThan(GIFT_CHANCE + 0.03);
    const rare = got.filter((i) => INGREDIENTS[i as IngredientId].rarity === 'rare').length;
    expect(rare / got.length).toBeGreaterThan(0.3);
    expect(rare / got.length).toBeLessThan(0.5);
    expect(Object.values(g.state.inventory).reduce((a, b) => a + b, 0)).toBe(got.length);
  });

  /** Lv.3 dishes and two plants make guests happy enough to leave gifts. */
  function happyRestaurant(seed: number): Game {
    const g = game(seed);
    for (const id of RECIPE_IDS) g.state.recipes[id].level = 3;
    for (let i = 0; i < 3; i++) {
      const spot = findFreeSpot(g.state, 'plant_potted');
      if (!spot) break;
      g.state.furniture.push({
        id: `p${i}`,
        defId: 'plant_potted',
        x: spot.x,
        y: spot.y,
        rot: 0,
        level: 1,
      });
    }
    g.invalidateWalkGrid();
    return g;
  }

  function run(seed: number, days: number) {
    const g = happyRestaurant(seed);
    const gifts: string[] = [];
    let eligible = 0;
    g.events.on('giftReceived', (e) => gifts.push(`${e.guestName}:${e.ingredient}`));
    g.events.on('paid', (e) => {
      const c = g.state.characters.find((x) => x.id === e.guestId);
      if (c && isGuest(c) && c.happiness >= GIFT_MIN_HAPPINESS) eligible++;
    });
    let giftStat = 0;
    for (let d = 0; d < days; d++) {
      playDay(g);
      giftStat += g.state.dayStats.gifts;
      nextDay(g);
    }
    return { gifts, eligible, giftStat };
  }

  it('are deterministic per seed; measured over a multi-day headless run', () => {
    expect(run(5, 3)).toEqual(run(5, 3));
    let gifts = 0;
    let eligible = 0;
    let stat = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const r = run(seed, 4);
      gifts += r.gifts.length;
      eligible += r.eligible;
      stat += r.giftStat;
    }
    expect(eligible).toBeGreaterThan(100);
    expect(gifts).toBeGreaterThan(0);
    // The report's gift count equals the events.
    expect(stat).toBe(gifts);
    // About 12 % of the very happy guests leave a gift.
    expect(gifts / eligible).toBeGreaterThan(0.05);
    expect(gifts / eligible).toBeLessThan(0.22);
  });
});

describe('rank-up reward', () => {
  it('grants the reward ingredient once and puts it in the event', () => {
    const g = game();
    const ups: { rank: number; reward: string | null }[] = [];
    g.events.on('rankUp', (e) => ups.push({ rank: e.rank, reward: e.reward }));
    const rank2 = RANKS[1];
    if (!rank2) throw new Error('rank 2 missing');
    expect(rank2.reward).toBe('buffalo_mozzarella');
    addFame(g.state, g.events, rank2.fame);
    expect(ups).toEqual([{ rank: 2, reward: 'buffalo_mozzarella' }]);
    expect(g.state.inventory.buffalo_mozzarella).toBe(1);
    addFame(g.state, g.events, 5);
    expect(g.state.inventory.buffalo_mozzarella).toBe(1);
    expect(g.state.rank).toBe(2);
  });
});
