/**
 * Audio data (M10): placeholder SFX and the day music, synthesised in code with the Web Audio
 * API (no asset files). All volumes live here so they can be tuned without touching the engine.
 * Everything is deliberately soft: ART_DIRECTION §9 asks for cozy, never loud.
 */

export type SfxId =
  'coin' | 'doorBell' | 'ovenDing' | 'pop' | 'place' | 'levelUp' | 'rankUp' | 'gift' | 'aww';

export type ToneWave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

/** One voice of a sound effect (sfxr-style: a shaped oscillator or a band of noise). */
export interface Tone {
  wave: ToneWave;
  /** Hz; for noise the centre of the band. */
  freq: number;
  /** Optional end frequency of an exponential glide. */
  slideTo?: number;
  /** Start offset from the moment the sound is played, in seconds. */
  at: number;
  /** Length in seconds (the envelope decays to silence by then). */
  dur: number;
  /** Peak level 0..1, relative to the sound's own volume. */
  gain: number;
  /** Attack in seconds (default `DEFAULT_ATTACK_SEC`). */
  attack?: number;
}

export interface SfxDef {
  /** Level of the whole sound 0..1 (multiplied by the master and SFX volumes). */
  volume: number;
  /** Minimum gap between two plays of this sound, in ms (rate limit for busy rushes). */
  minGapMs: number;
  tones: readonly Tone[];
}

export const DEFAULT_ATTACK_SEC = 0.006;

/** Frequency of a note name such as "C5" or "F#4" (equal temperament, A4 = 440 Hz). */
export function noteHz(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(m[3]) + 1) + base + shift;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const hz = noteHz;

export const VOLUME = {
  /** Overall level before everything else. */
  master: 0.8,
  /** Bus level of all sound effects. */
  sfx: 0.7,
  /** Bus level of the day music. */
  musicDay: 0.3,
  /** Bus level of the soft music variant (closing, report, night). */
  musicSoft: 0.1,
} as const;

/** How many sound effects may start within `windowMs` before further ones are dropped. */
export const SFX_BURST = { windowMs: 600, max: 5 } as const;

export const SFX: Record<SfxId, SfxDef> = {
  // Two quick bright blips (a small "ka-ching").
  coin: {
    volume: 0.35,
    minGapMs: 140,
    tones: [
      { wave: 'square', freq: hz('B5'), at: 0, dur: 0.07, gain: 0.5 },
      { wave: 'square', freq: hz('E6'), at: 0.06, dur: 0.22, gain: 0.5 },
    ],
  },
  // Soft "ding-dong" of the door bell.
  doorBell: {
    volume: 0.45,
    minGapMs: 500,
    tones: [
      { wave: 'sine', freq: hz('E6'), at: 0, dur: 0.5, gain: 0.7 },
      { wave: 'sine', freq: hz('C6'), at: 0.22, dur: 0.7, gain: 0.7 },
    ],
  },
  // Single bright "ding" (the oven timer).
  ovenDing: {
    volume: 0.4,
    minGapMs: 350,
    tones: [
      { wave: 'triangle', freq: hz('A6'), at: 0, dur: 0.55, gain: 0.7 },
      { wave: 'sine', freq: hz('A5'), at: 0, dur: 0.4, gain: 0.3 },
    ],
  },
  // Tiny rising bubble.
  pop: {
    volume: 0.3,
    minGapMs: 120,
    tones: [{ wave: 'sine', freq: 420, slideTo: 880, at: 0, dur: 0.09, gain: 0.8 }],
  },
  // Soft wooden thud plus a tick.
  place: {
    volume: 0.5,
    minGapMs: 150,
    tones: [
      { wave: 'sine', freq: 200, slideTo: 80, at: 0, dur: 0.14, gain: 0.9 },
      { wave: 'noise', freq: 1800, at: 0, dur: 0.04, gain: 0.35 },
    ],
  },
  // Short happy arpeggio, four notes.
  levelUp: {
    volume: 0.45,
    minGapMs: 400,
    tones: [
      { wave: 'triangle', freq: hz('C5'), at: 0, dur: 0.14, gain: 0.7 },
      { wave: 'triangle', freq: hz('E5'), at: 0.11, dur: 0.14, gain: 0.7 },
      { wave: 'triangle', freq: hz('G5'), at: 0.22, dur: 0.14, gain: 0.7 },
      { wave: 'triangle', freq: hz('C6'), at: 0.33, dur: 0.55, gain: 0.8 },
      { wave: 'sine', freq: hz('C7'), at: 0.33, dur: 0.4, gain: 0.15 },
    ],
  },
  // A little bigger: six notes and a warm chord underneath.
  rankUp: {
    volume: 0.5,
    minGapMs: 1000,
    tones: [
      { wave: 'triangle', freq: hz('C5'), at: 0, dur: 0.16, gain: 0.7 },
      { wave: 'triangle', freq: hz('E5'), at: 0.13, dur: 0.16, gain: 0.7 },
      { wave: 'triangle', freq: hz('G5'), at: 0.26, dur: 0.16, gain: 0.7 },
      { wave: 'triangle', freq: hz('C6'), at: 0.39, dur: 0.16, gain: 0.7 },
      { wave: 'triangle', freq: hz('E6'), at: 0.52, dur: 0.16, gain: 0.7 },
      { wave: 'triangle', freq: hz('G6'), at: 0.65, dur: 0.9, gain: 0.8 },
      { wave: 'sine', freq: hz('C5'), at: 0.65, dur: 0.9, gain: 0.35 },
      { wave: 'sine', freq: hz('E5'), at: 0.65, dur: 0.9, gain: 0.3 },
    ],
  },
  // Two high, glassy notes.
  gift: {
    volume: 0.4,
    minGapMs: 500,
    tones: [
      { wave: 'sine', freq: hz('E6'), at: 0, dur: 0.35, gain: 0.7 },
      { wave: 'sine', freq: hz('B6'), at: 0.12, dur: 0.6, gain: 0.7 },
      { wave: 'sine', freq: hz('E7'), at: 0.12, dur: 0.4, gain: 0.15 },
    ],
  },
  // A gentle two-note sigh, falling. Not a punishment.
  aww: {
    volume: 0.22,
    minGapMs: 800,
    tones: [
      { wave: 'sine', freq: hz('G4'), slideTo: hz('E4'), at: 0, dur: 0.3, gain: 0.8, attack: 0.04 },
      {
        wave: 'sine',
        freq: hz('E4'),
        slideTo: hz('C4'),
        at: 0.25,
        dur: 0.45,
        gain: 0.8,
        attack: 0.04,
      },
    ],
  },
};

/** The day music: plucked mandolin-like arpeggios over a four-bar progression. */
export const MUSIC = {
  bpm: 80,
  /** Eighth notes per bar. */
  stepsPerBar: 8,
  /** Chords (one per bar): bass note and the chord tones the pluck pattern picks from. */
  bars: [
    { bass: hz('C3'), tones: [hz('C4'), hz('E4'), hz('G4'), hz('C5')] },
    { bass: hz('A2'), tones: [hz('A3'), hz('C4'), hz('E4'), hz('A4')] },
    { bass: hz('F2'), tones: [hz('F3'), hz('A3'), hz('C4'), hz('F4')] },
    { bass: hz('G2'), tones: [hz('G3'), hz('B3'), hz('D4'), hz('G4')] },
  ],
  /** Two alternating bar patterns: index into the chord tones, -1 = rest. */
  patterns: [
    [0, 2, 1, 2, 3, 2, 1, 2],
    [0, -1, 1, 2, -1, 3, 2, 1],
  ],
  pluckGain: 0.5,
  pluckDecaySec: 0.42,
  bassGain: 0.5,
  bassDecaySec: 1.1,
  /** Low-pass cut-off (Hz) of the day and soft variants. */
  cutoffDay: 4200,
  cutoffSoft: 1100,
  /** Seconds the bus takes to glide between the day and soft level. */
  moodGlideSec: 1.2,
  /** Scheduler: how far ahead notes are queued and how often the queue is topped up. */
  lookaheadSec: 1.2,
  tickMs: 250,
} as const;
