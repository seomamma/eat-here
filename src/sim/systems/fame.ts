import { MAX_RANK, RANKS, rankDef } from '../../data/ranks';
import { RECIPES } from '../../data/recipes';
import { unlocksAtRank } from '../../data/shop';
import { growthAtRank } from '../../data/expansion';
import { addIngredient } from './market';
import { expandRoom } from './expansion';
import type { Emitter, GameEvents } from '../events';
import type { GameState } from '../state';

/** Names of what a rank unlocks (recipes first, then perks), for the RANK UP modal. */
export function unlockNames(rank: number): string[] {
  const def = rankDef(rank);
  return [...def.recipes.map((id) => RECIPES[id].name), ...unlocksAtRank(rank), ...def.perks];
}

/**
 * Promotes the restaurant while the fame threshold of the next rank is reached. The rank in
 * state is the only guard, so a rank can never fire twice.
 */
export function checkRankUp(state: GameState, events: Emitter<GameEvents>): void {
  while (state.rank < MAX_RANK) {
    const next = RANKS[state.rank]; // index = current rank = next rank's number - 1
    if (!next || state.fame < next.fame) return;
    state.rank = next.rank;
    for (const id of next.recipes) state.recipes[id].unlocked = true;
    if (next.reward) addIngredient(state, events, next.reward);
    const growth = growthAtRank(next.rank);
    const added = growth ? expandRoom(state, growth) : null;
    if (added) events.emit('roomExpanded', { rank: next.rank, added, room: { ...state.room } });
    events.emit('rankUp', {
      rank: next.rank,
      name: next.name,
      unlocks: unlockNames(next.rank),
      reward: next.reward,
      space: added,
    });
  }
}

/** Adds fame, emits `fameChanged` and checks for a rank up. */
export function addFame(state: GameState, events: Emitter<GameEvents>, gained: number): void {
  if (gained <= 0) return;
  state.fame += gained;
  checkRankUp(state, events);
  events.emit('fameChanged', { fame: state.fame, gained, rank: state.rank });
}
