import {
  DEFAULT_ATTACK_SEC,
  MUSIC,
  SFX,
  SFX_BURST,
  VOLUME,
  type SfxId,
  type Tone,
} from '../data/audio';
import { burstBudget, gapPassed } from './audioRate';
import type { Settings } from './settings';

/** How loud the music is: full day level, or the soft variant (closing, report, night). */
export type MusicMood = 'day' | 'soft';

type ContextCtor = new () => AudioContext;

function contextCtor(): ContextCtor | null {
  const g = globalThis as unknown as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Fine-grained wall clock for rate limits. */
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Procedural audio (M10): SFX and music are synthesised with the Web Audio API, no files.
 * The context is created on the first user gesture (`unlock`, mobile autoplay rules). Every
 * public method is safe to call at any time: with no context or a blocked one it does nothing.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly lastAt = new Map<SfxId, number>();
  private recent: number[] = [];

  private sfxOn: boolean;
  private musicOn: boolean;
  private mood: MusicMood = 'day';
  private suspendedByApp = false;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  /** Context time of the next music step and the running step counter. */
  private nextStepAt = 0;
  private step = 0;

  constructor(settings: Settings) {
    this.sfxOn = settings.sfx;
    this.musicOn = settings.music;
  }

  /** True once a context exists (after the first gesture, if the browser has Web Audio). */
  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Call from a user gesture: creates the context on first use and resumes it if suspended. */
  unlock(): void {
    try {
      if (!this.ctx) this.createContext();
      const ctx = this.ctx;
      if (!ctx) return;
      if (!this.suspendedByApp && ctx.state !== 'running') void ctx.resume().catch(() => {});
      this.syncMusic();
    } catch {
      /* no Web Audio here: the game stays silent */
    }
  }

  private createContext(): void {
    const Ctor = contextCtor();
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = VOLUME.master;
    master.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = VOLUME.sfx;
    sfx.connect(master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = MUSIC.cutoffDay;
    const music = ctx.createGain();
    music.gain.value = 0;
    filter.connect(music);
    music.connect(master);
    this.ctx = ctx;
    this.sfxBus = sfx;
    this.musicBus = music;
    this.musicFilter = filter;
    // One second of white noise, reused by every noise tone.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  /** Applies the sound toggles (called whenever the settings change). */
  applySettings(settings: Settings): void {
    this.sfxOn = settings.sfx;
    this.musicOn = settings.music;
    this.syncMusic();
  }

  /** Switches the music between its full day level and the soft variant. */
  setMood(mood: MusicMood): void {
    this.mood = mood;
    this.syncMusic();
  }

  /** Page hidden: stop the audio clock. */
  pause(): void {
    this.suspendedByApp = true;
    try {
      void this.ctx?.suspend().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /** Page visible again. */
  resume(): void {
    this.suspendedByApp = false;
    try {
      if (this.ctx) void this.ctx.resume().catch(() => {});
      // The audio clock stood still; restart the music queue from "now".
      if (this.ctx) this.nextStepAt = this.ctx.currentTime + 0.05;
    } catch {
      /* ignore */
    }
  }

  /** Plays a sound effect unless sound is off, the context is not running, or it is rate-limited. */
  play(id: SfxId): void {
    const ctx = this.ctx;
    if (!this.sfxOn || !ctx || !this.sfxBus || ctx.state !== 'running') return;
    const def = SFX[id];
    const now = clock();
    if (!gapPassed(this.lastAt.get(id), now, def.minGapMs)) return;
    const burst = burstBudget(this.recent, now, SFX_BURST.windowMs, SFX_BURST.max);
    this.recent = burst.recent;
    if (!burst.ok) return;
    this.lastAt.set(id, now);
    this.recent.push(now);
    try {
      const t0 = ctx.currentTime + 0.01;
      for (const tone of def.tones) this.voice(tone, t0, def.volume, this.sfxBus);
    } catch {
      /* a failed voice must never break the game */
    }
  }

  /** Schedules one tone: oscillator (or filtered noise) with a quick attack and exponential decay. */
  private voice(tone: Tone, t0: number, volume: number, bus: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = t0 + tone.at;
    const end = start + tone.dur;
    const peak = Math.max(0.0001, tone.gain * volume);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(peak, start + (tone.attack ?? DEFAULT_ATTACK_SEC));
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(bus);
    if (tone.wave === 'noise') {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = tone.freq;
      src.connect(band);
      band.connect(env);
      src.start(start);
      src.stop(end + 0.02);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(tone.slideTo, end);
    osc.connect(env);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  // --- Music -------------------------------------------------------------------------------

  private musicLevel(): number {
    return this.mood === 'day' ? VOLUME.musicDay : VOLUME.musicSoft;
  }

  /** Starts, stops or re-levels the music to match the toggle and mood. */
  private syncMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus || !this.musicFilter) return;
    const glide = MUSIC.moodGlideSec / 3;
    if (!this.musicOn) {
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      return;
    }
    bus.gain.setTargetAtTime(this.musicLevel(), ctx.currentTime, glide);
    this.musicFilter.frequency.setTargetAtTime(
      this.mood === 'day' ? MUSIC.cutoffDay : MUSIC.cutoffSoft,
      ctx.currentTime,
      glide,
    );
    if (this.musicTimer === null) {
      this.nextStepAt = ctx.currentTime + 0.1;
      this.musicTimer = setInterval(() => this.scheduleMusic(), MUSIC.tickMs);
      this.scheduleMusic();
    }
  }

  /** Queues every music step that falls inside the lookahead window. */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicFilter;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const stepSec = 60 / MUSIC.bpm / 2;
    if (this.nextStepAt < ctx.currentTime) this.nextStepAt = ctx.currentTime + 0.05;
    try {
      while (this.nextStepAt < ctx.currentTime + MUSIC.lookaheadSec) {
        this.musicStep(this.nextStepAt);
        this.nextStepAt += stepSec;
        this.step++;
      }
    } catch {
      /* ignore */
    }
  }

  private musicStep(at: number): void {
    const bus = this.musicFilter;
    if (!bus) return;
    const inBar = this.step % MUSIC.stepsPerBar;
    const barNo = Math.floor(this.step / MUSIC.stepsPerBar);
    const bar = MUSIC.bars[barNo % MUSIC.bars.length];
    const pattern = MUSIC.patterns[barNo % MUSIC.patterns.length];
    if (!bar || !pattern) return;
    if (inBar === 0) {
      this.voice(
        { wave: 'sine', freq: bar.bass, at: 0, dur: MUSIC.bassDecaySec, gain: MUSIC.bassGain },
        at,
        1,
        bus,
      );
    }
    const idx: number = pattern[inBar] ?? -1;
    const freq = idx >= 0 ? bar.tones[idx] : undefined;
    if (freq === undefined) return;
    // Mandolin-ish pluck: a triangle body with a thin square edge, fast decay.
    this.voice(
      { wave: 'triangle', freq, at: 0, dur: MUSIC.pluckDecaySec, gain: MUSIC.pluckGain },
      at,
      1,
      bus,
    );
    this.voice(
      {
        wave: 'square',
        freq: freq * 2,
        at: 0,
        dur: MUSIC.pluckDecaySec / 3,
        gain: MUSIC.pluckGain / 6,
      },
      at,
      1,
      bus,
    );
  }
}
