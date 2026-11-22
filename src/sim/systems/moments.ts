import { MOMENTS, type MomentDef, type MomentReward, type MomentTrigger } from '../../data/moments';
import { recordLedger } from '../dayStats';
import type { Emitter, GameEvents } from '../events';
import type { GameState } from '../state';
import { addFame } from './fame';
import { addIngredient } from './market';

/** True when the condition holds in the given state (pure; no side effects). */
export function triggerMet(state: GameState, t: MomentTrigger): boolean {
  switch (t.kind) {
    case 'servedCount':
      return (state.counters.served[t.recipe] ?? 0) >= t.count;
    case 'servedLevel':
      return (state.counters.servedLevel[t.recipe] ?? 0) >= t.level;
    case 'hearts':
      return state.regulars[t.regular].hearts >= t.hearts;
    case 'recipeLevel':
      return state.recipes[t.recipe].level >= t.level;
    case 'rank':
      return state.rank >= t.rank;
    case 'day':
      return state.clock.day >= t.day;
  }
}

function applyReward(
  state: GameState,
  events: Emitter<GameEvents>,
  moment: MomentDef,
  reward: MomentReward,
): void {
  if (reward.unlockRegular) state.regulars[reward.unlockRegular].unlocked = true;
  if (reward.coins) {
    state.money += reward.coins;
    recordLedger(state.dayStats, state.tick, 'moment', reward.coins, moment.card.title);
    events.emit('moneyChanged', { money: state.money });
  }
  if (reward.ingredient) addIngredient(state, events, reward.ingredient);
  if (reward.fame) addFame(state, events, reward.fame);
}

/**
 * Fires every moment whose condition is now met and that has not fired yet. Called after
 * anything that can change a condition (a dish was paid, a heart was given, a recipe leveled
 * up, a new day began). A moment is stored in `momentsSeen` before its reward is applied, so it
 * can never fire twice.
 */
export function checkMoments(state: GameState, events: Emitter<GameEvents>): void {
  for (const moment of MOMENTS) {
    if (state.momentsSeen.includes(moment.id) || !triggerMet(state, moment.trigger)) continue;
    state.momentsSeen.push(moment.id);
    if (moment.reward) applyReward(state, events, moment, moment.reward);
    events.emit('momentTriggered', {
      id: moment.id,
      card: moment.card,
      reward: moment.reward ?? null,
    });
  }
}
