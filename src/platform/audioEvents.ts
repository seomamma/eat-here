import type { Game } from '../sim/game';
import type { AudioEngine, MusicMood } from './audio';

/** Sim phases that get the soft music variant. */
const SOFT_PHASES = new Set(['closing', 'report', 'night']);

/** Plays sounds from sim events (the sim itself stays pure) and follows the day/night mood. */
export function bindAudioEvents(game: Game, audio: AudioEngine): () => void {
  const { events } = game;
  const mood = (phase: string): MusicMood => (SOFT_PHASES.has(phase) ? 'soft' : 'day');
  audio.setMood(mood(game.state.clock.phase));
  const offs = [
    events.on('paid', () => audio.play('coin')),
    events.on('guestArrived', () => audio.play('doorBell')),
    events.on('dishReady', () => audio.play('ovenDing')),
    events.on('guestEmote', (e) => {
      if (e.emote === 'angry') audio.play('aww');
      else if (e.emote === 'tasty' || e.emote === 'love' || e.emote === 'hand') audio.play('pop');
    }),
    events.on('furniturePlaced', () => audio.play('place')),
    events.on('furnitureMoved', () => audio.play('place')),
    events.on('recipeLeveledUp', () => audio.play('levelUp')),
    events.on('rankUp', () => audio.play('rankUp')),
    events.on('giftReceived', () => audio.play('gift')),
    events.on('phaseChanged', (e) => audio.setMood(mood(e.phase))),
  ];
  return () => offs.forEach((off) => off());
}
