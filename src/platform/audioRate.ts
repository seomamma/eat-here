/** Pure helpers that keep a busy rush from turning into noise (used by the audio engine). */

/** True when at least `minGapMs` passed since this sound last played (or it never did). */
export function gapPassed(lastAt: number | undefined, now: number, minGapMs: number): boolean {
  return lastAt === undefined || now - lastAt >= minGapMs;
}

/**
 * Burst budget: given the start times of recent sounds, drops the ones older than the window
 * and says whether one more may start now. Returns the pruned list (without `now`).
 */
export function burstBudget(
  recent: readonly number[],
  now: number,
  windowMs: number,
  max: number,
): { recent: number[]; ok: boolean } {
  const kept = recent.filter((t) => now - t < windowMs);
  return { recent: kept, ok: kept.length < max };
}
