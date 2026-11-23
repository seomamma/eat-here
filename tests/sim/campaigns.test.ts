import { describe, expect, it } from 'vitest';
import { CAMPAIGNS, type CampaignId } from '../../src/data/campaigns';
import { MAX_GUESTS_ALIVE } from '../../src/data/balance';
import { ledgerTotal } from '../../src/sim/dayStats';
import { isGuest } from '../../src/sim/characters';
import { Game } from '../../src/sim/game';
import { deserialize, serialize } from '../../src/sim/save';
import { createInitialState } from '../../src/sim/state';
import {
  appealMultiplier,
  campaignMultiplier,
  isRushActive,
  validateStartCampaign,
} from '../../src/sim/systems/campaigns';
import { arrivalMultiplier } from '../../src/sim/systems/spawner';
import { DAY_TICKS, NIGHT_TICKS } from '../../src/sim/time';
import fixtureV6Text from '../fixtures/save-v6.json?raw';

const AT = 1_700_000_000_000;

function game(seed = 1, rank = 1, money = 1000): Game {
  const state = createInitialState(seed);
  state.rank = rank;
  state.money = money;
  return new Game(state);
}

function nextDay(g: Game): void {
  for (let i = 0; i < DAY_TICKS * 3 && g.state.clock.phase !== 'report'; i++) g.tickOnce();
  expect(g.state.clock.phase).toBe('report');
  g.dispatch({ type: 'continueAfterReport' });
  for (let i = 0; i < NIGHT_TICKS + 2 && g.state.clock.phase === 'night'; i++) g.tickOnce();
}

describe('startCampaign', () => {
  it('pays the cost, writes an "ads" ledger line and counts the campaign', () => {
    const g = game(1, 1, 100);
    const events: string[] = [];
    g.events.on('campaignStarted', (e) => events.push(e.id));
    expect(g.dispatch({ type: 'startCampaign', id: 'flyers' })).toEqual({ ok: true });
    expect(g.state.money).toBe(100 - CAMPAIGNS.flyers.cost);
    expect(g.state.counters.campaigns).toBe(1);
    expect(g.state.campaign).toMatchObject({ id: 'flyers', startDay: 1, endDay: 1 });
    expect(ledgerTotal(g.state.dayStats.ledger, 'ads')).toBe(-CAMPAIGNS.flyers.cost);
    expect(g.state.dayStats.ledger.entries.find((e) => e.kind === 'ads')).toMatchObject({
      label: 'flyers',
      amount: -CAMPAIGNS.flyers.cost,
    });
    expect(events).toEqual(['flyers']);
  });

  it('is refused without money, below the rank, while one runs, and at night or in the report', () => {
    const g = game(1, 1, CAMPAIGNS.flyers.cost - 1);
    expect(g.dispatch({ type: 'startCampaign', id: 'flyers' })).toEqual({
      ok: false,
      reason: 'notEnoughMoney',
    });
    g.state.money = 1000;
    expect(g.dispatch({ type: 'startCampaign', id: 'poster' })).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(g.dispatch({ type: 'startCampaign', id: 'radio' })).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(g.dispatch({ type: 'startCampaign', id: 'flyers' })).toEqual({ ok: true });
    g.state.rank = 3;
    expect(g.dispatch({ type: 'startCampaign', id: 'poster' })).toEqual({
      ok: false,
      reason: 'busy',
    });
    expect(g.state.money).toBe(1000 - CAMPAIGNS.flyers.cost);
    const n = createInitialState(1);
    n.money = 1000;
    for (const phase of ['night', 'report'] as const) {
      n.clock.phase = phase;
      expect(validateStartCampaign(n, 'flyers')).toEqual({ ok: false, reason: 'notNow' });
    }
    expect(validateStartCampaign(n, 'nope' as CampaignId)).toEqual({
      ok: false,
      reason: 'unknownCampaign',
    });
  });

  it('flyers: +40% arrivals for the rest of the day only', () => {
    const g = game(2);
    const before = arrivalMultiplier(g.state);
    g.dispatch({ type: 'startCampaign', id: 'flyers' });
    expect(arrivalMultiplier(g.state) / before).toBeCloseTo(1.4, 5);
    expect(campaignMultiplier(g.state)).toBe(1.4);
    const ended: string[] = [];
    g.events.on('campaignEnded', (e) => ended.push(e.id));
    nextDay(g);
    expect(g.state.clock.day).toBe(2);
    g.tickOnce();
    expect(g.state.campaign).toBeNull();
    expect(ended).toEqual(['flyers']);
    expect(arrivalMultiplier(g.state)).toBeCloseTo(before, 5);
  });

  it('poster: +60% today and tomorrow, gone on the third day', () => {
    const g = game(3, 2);
    g.dispatch({ type: 'startCampaign', id: 'poster' });
    expect(g.state.campaign?.endDay).toBe(2);
    expect(campaignMultiplier(g.state)).toBe(1.6);
    nextDay(g);
    g.tickOnce();
    expect(g.state.campaign?.id).toBe('poster');
    expect(campaignMultiplier(g.state)).toBe(1.6);
    nextDay(g);
    g.tickOnce();
    expect(g.state.campaign).toBeNull();
  });

  it('a campaign makes more guests arrive over a day (flyers, same seeds)', () => {
    const arrivals = (flyers: boolean): number => {
      let total = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const g = game(seed);
        if (flyers) g.dispatch({ type: 'startCampaign', id: 'flyers' });
        g.events.on('guestArrived', () => total++);
        for (let i = 0; i < DAY_TICKS; i++) g.tickOnce();
      }
      return total;
    };
    const plain = arrivals(false);
    const boosted = arrivals(true);
    expect(boosted).toBeGreaterThan(plain * 1.2);
  });

  it('first campaign fires the "whole street" moment once', () => {
    const g = game(4, 2);
    const moments: string[] = [];
    g.events.on('momentTriggered', (e) => moments.push(e.card.title));
    g.dispatch({ type: 'startCampaign', id: 'flyers' });
    expect(moments).toEqual(['The whole street heard about your pizzas!']);
    nextDay(g);
    g.tickOnce();
    g.dispatch({ type: 'startCampaign', id: 'poster' });
    expect(moments).toHaveLength(1);
  });
});

describe('radio rush', () => {
  it('schedules the next lunch or dinner rush with a fixed number of parties', () => {
    const g = game(5, 3);
    // At 10:00 the next rush is lunch (12:00) today.
    g.dispatch({ type: 'startCampaign', id: 'radio' });
    const rush = g.state.campaign?.rush;
    const eff = CAMPAIGNS.radio.effect;
    if (eff.kind !== 'rush') throw new Error('radio is a rush');
    expect(rush).toMatchObject({ day: 1, startMinute: 720, endMinute: 780, announced: false });
    expect(rush?.pending).toHaveLength(eff.parties);
    expect(rush?.pending.every((m) => m >= 720 && m < 780)).toBe(true);
    expect([...(rush?.pending ?? [])].sort((a, b) => a - b)).toEqual(rush?.pending);
    // After lunch has started: dinner.
    const h = game(5, 3);
    h.state.clock.minuteOfDay = 800;
    h.dispatch({ type: 'startCampaign', id: 'radio' });
    expect(h.state.campaign?.rush).toMatchObject({ day: 1, startMinute: 1080 });
    // After dinner started: lunch of the next day.
    const k = game(5, 3);
    k.state.clock.minuteOfDay = 1100;
    k.dispatch({ type: 'startCampaign', id: 'radio' });
    expect(k.state.campaign?.rush).toMatchObject({ day: 2, startMinute: 720 });
  });

  it('brings the whole burst within the hour, announces it once, then ends', () => {
    const g = game(6, 3);
    g.dispatch({ type: 'startCampaign', id: 'radio' });
    const started: number[] = [];
    const ended: string[] = [];
    g.events.on('rushStarted', (e) => started.push(e.day));
    g.events.on('campaignEnded', (e) => ended.push(e.id));
    const arrivalsAt: number[] = [];
    g.events.on('guestArrived', () => arrivalsAt.push(g.state.clock.minuteOfDay));
    let rushTicks = 0;
    let active = 0;
    const startPending = g.state.campaign?.rush?.pending.length ?? 0;
    for (let i = 0; i < DAY_TICKS && ended.length === 0; i++) {
      g.tickOnce();
      if (isRushActive(g.state)) active++;
      // Never more guests than the limit, even in the rush.
      expect(g.state.characters.filter(isGuest).length).toBeLessThanOrEqual(MAX_GUESTS_ALIVE);
      rushTicks++;
    }
    expect(started).toEqual([1]);
    expect(ended).toEqual(['radio']);
    expect(g.state.campaign).toBeNull();
    // The rush hour is 60 in-game minutes = 20 real seconds = 200 ticks.
    expect(active).toBeGreaterThanOrEqual(190);
    expect(active).toBeLessThanOrEqual(210);
    expect(startPending).toBe(
      CAMPAIGNS.radio.effect.kind === 'rush' ? CAMPAIGNS.radio.effect.parties : 0,
    );
    expect(rushTicks).toBeGreaterThan(0);
  });

  it('rush parties all show up in the hour when there is room (and none are lost)', () => {
    const g = game(7, 3);
    g.dispatch({ type: 'startCampaign', id: 'radio' });
    // Stop the normal arrivals so only the rush brings guests.
    g.state.guestSpawn.enabled = false;
    const parties = new Set<string>();
    let solos = 0;
    g.events.on('guestArrived', (e) => {
      const c = g.state.characters.find((x) => x.id === e.guestId);
      if (c && isGuest(c)) {
        if (c.partyId) parties.add(c.partyId);
        else solos++;
      }
    });
    for (let i = 0; i < DAY_TICKS && g.state.clock.minuteOfDay < 790; i++) g.tickOnce();
    // Every rush party was created, except the ones turned away because the room was full.
    expect(parties.size + solos).toBeGreaterThanOrEqual(3);
    expect(parties.size + solos).toBeLessThanOrEqual(6);
    expect(g.state.campaign?.rush?.pending ?? []).toHaveLength(0);
  });

  it('a rush bought after the last one of the day waits for tomorrow lunch and survives the night', () => {
    const g = game(8, 3);
    g.state.clock.minuteOfDay = 1100;
    g.dispatch({ type: 'startCampaign', id: 'radio' });
    nextDay(g);
    g.tickOnce();
    expect(g.state.campaign?.id).toBe('radio');
    expect(g.state.clock.day).toBe(2);
  });
});

describe('curb appeal', () => {
  it('decor adds a small capped share to the arrival rate', () => {
    const state = createInitialState(1);
    expect(appealMultiplier(state)).toBe(1);
    state.furniture.push({ id: 'x1', defId: 'plant_potted', x: 5, y: 9, rot: 0, level: 1 });
    expect(appealMultiplier(state)).toBeGreaterThan(1);
    for (let i = 0; i < 40; i++)
      state.furniture.push({ id: `x${i + 2}`, defId: 'statue', x: 5, y: 9, rot: 0, level: 5 });
    expect(appealMultiplier(state)).toBeCloseTo(1.3, 5);
  });
});

describe('save v6 -> v7', () => {
  const raw = JSON.parse(fixtureV6Text) as { version: number; state: Record<string, unknown> };
  const res = deserialize(fixtureV6Text);

  it('loads a v6 save mid-visit: guests become solo adults, no parties, no campaign', () => {
    expect(raw.version).toBe(6);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = res.state;
    expect(s.version).toBe(7);
    expect(s.parties).toEqual([]);
    expect(s.campaign).toBeNull();
    expect(s.nextPartyId).toBe(1);
    expect(s.counters.campaigns).toBe(0);
    const guests = s.characters.filter(isGuest);
    expect(guests.length).toBeGreaterThan(0);
    for (const gu of guests) {
      expect(gu.kid).toBe(false);
      expect(gu.partyId).toBeNull();
    }
  });

  it('plays on after the migration: nothing breaks, everyone leaves by the report', () => {
    if (!res.ok) throw new Error('load failed');
    const g = new Game(structuredClone(res.state));
    let ticks = 0;
    while (g.state.clock.phase !== 'report' && ticks++ < 20_000) g.tickOnce();
    expect(g.state.clock.phase).toBe('report');
    expect(g.state.characters.filter(isGuest)).toHaveLength(0);
    expect(g.state.dayStats.guestsServed).toBeGreaterThan(0);
  });

  it('round-trips a running campaign and parties through save and load', () => {
    const g = game(9, 3);
    g.dispatch({ type: 'startCampaign', id: 'radio' });
    for (let i = 0; i < 300; i++) g.tickOnce();
    const again = deserialize(serialize(g.state, AT));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.state.campaign).toEqual(g.state.campaign);
    expect(again.state.parties).toEqual(g.state.parties);
    // A copy continues exactly like the original.
    const a = new Game(structuredClone(again.state));
    for (let i = 0; i < 400; i++) {
      g.tickOnce();
      a.tickOnce();
    }
    expect(serialize(a.state, AT) === serialize(g.state, AT)).toBe(true);
  });

  it('rejects a broken campaign', () => {
    const g = game(9, 3);
    g.dispatch({ type: 'startCampaign', id: 'flyers' });
    const f = JSON.parse(serialize(g.state, AT)) as { state: { campaign: { id: string } } };
    f.state.campaign.id = 'billboard';
    expect(deserialize(JSON.stringify(f)).ok).toBe(false);
  });
});
