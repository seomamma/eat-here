import type { Game } from '../sim/game';

/** Pauses the sim while the page is hidden (tab switch, app in background); resumes when visible. */
export function bindLifecycle(game: Game, doc: Document = document): () => void {
  const sync = (): void => {
    if (doc.hidden || doc.visibilityState === 'hidden') game.pause();
    else game.resume();
  };
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => doc.removeEventListener('visibilitychange', sync);
}
