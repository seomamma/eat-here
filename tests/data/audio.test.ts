import { describe, expect, it } from 'vitest';
import { MUSIC, SFX, VOLUME, noteHz, type SfxId } from '../../src/data/audio';

const IDS: SfxId[] = [
  'coin',
  'doorBell',
  'ovenDing',
  'pop',
  'place',
  'levelUp',
  'rankUp',
  'gift',
  'aww',
];

describe('audio data', () => {
  it('converts note names to Hz', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 5);
    expect(noteHz('A5')).toBeCloseTo(880, 5);
    expect(noteHz('C4')).toBeCloseTo(261.63, 1);
    expect(noteHz('F#4')).toBeCloseTo(369.99, 1);
    expect(() => noteHz('H4')).toThrow();
  });

  it('defines every sound with sane, quiet numbers', () => {
    for (const id of IDS) {
      const def = SFX[id];
      expect(def, id).toBeDefined();
      expect(def.volume).toBeGreaterThan(0);
      expect(def.volume).toBeLessThanOrEqual(0.6);
      expect(def.minGapMs).toBeGreaterThan(0);
      expect(def.tones.length).toBeGreaterThan(0);
      for (const t of def.tones) {
        expect(t.freq).toBeGreaterThan(20);
        expect(t.freq).toBeLessThan(12000);
        expect(t.dur).toBeGreaterThan(0);
        expect(t.at).toBeGreaterThanOrEqual(0);
        expect(t.gain).toBeGreaterThan(0);
        expect(t.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the fanfares short and the rank-up bigger than the level-up', () => {
    const notes = (id: SfxId) => SFX[id].tones.filter((t) => t.wave === 'triangle').length;
    expect(notes('levelUp')).toBeGreaterThanOrEqual(4);
    expect(notes('levelUp')).toBeLessThanOrEqual(6);
    expect(notes('rankUp')).toBeGreaterThan(notes('levelUp'));
    const length = (id: SfxId) => Math.max(...SFX[id].tones.map((t) => t.at + t.dur));
    expect(length('levelUp')).toBeLessThan(1.2);
    expect(length('rankUp')).toBeLessThan(2);
  });

  it('keeps the angry-leaver sound very gentle', () => {
    expect(SFX.aww.volume).toBeLessThanOrEqual(SFX.coin.volume);
    expect(SFX.aww.tones.every((t) => t.wave === 'sine')).toBe(true);
  });

  it('keeps music low, softer at night, at a relaxed tempo', () => {
    expect(VOLUME.musicDay).toBeLessThanOrEqual(0.4);
    expect(VOLUME.musicSoft).toBeLessThan(VOLUME.musicDay);
    expect(MUSIC.bpm).toBeGreaterThanOrEqual(70);
    expect(MUSIC.bpm).toBeLessThanOrEqual(90);
  });

  it('has music patterns that only pick existing chord tones', () => {
    for (const bar of MUSIC.bars) {
      for (const pattern of MUSIC.patterns) {
        expect(pattern).toHaveLength(MUSIC.stepsPerBar);
        for (const i of pattern as readonly number[]) {
          expect(i === -1 || bar.tones[i] !== undefined).toBe(true);
        }
      }
    }
  });
});
