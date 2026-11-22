import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/platform/audio';

/** Minimal Web Audio fake that counts the oscillators started. */
function installFakeAudio(state: 'running' | 'suspended' = 'running') {
  const log = { oscillators: 0, resumed: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {},
  });
  const node = () => ({ connect: () => {}, gain: param(), frequency: param(), type: '' });
  class FakeContext {
    state: string = state;
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    createGain = node;
    createBiquadFilter = node;
    createOscillator() {
      log.oscillators++;
      return { ...node(), start: () => {}, stop: () => {} };
    }
    createBufferSource() {
      return { ...node(), start: () => {}, stop: () => {}, buffer: null };
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(8) };
    }
    resume() {
      log.resumed++;
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  return log;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AudioEngine', () => {
  it('is silent and never throws without Web Audio', () => {
    const a = new AudioEngine({ sfx: true, music: true });
    expect(() => {
      a.play('coin');
      a.unlock();
      a.setMood('soft');
      a.pause();
      a.resume();
    }).not.toThrow();
    expect(a.unlocked).toBe(false);
  });

  it('does not play before the first gesture, then plays after unlock', () => {
    const log = installFakeAudio();
    vi.useFakeTimers();
    const a = new AudioEngine({ sfx: true, music: false });
    a.play('doorBell');
    expect(log.oscillators).toBe(0);
    a.unlock();
    expect(a.unlocked).toBe(true);
    a.play('doorBell');
    expect(log.oscillators).toBeGreaterThan(0);
  });

  it('rate-limits a sound that fires many times at once', () => {
    const log = installFakeAudio();
    vi.useFakeTimers();
    const a = new AudioEngine({ sfx: true, music: false });
    a.unlock();
    a.play('coin');
    const once = log.oscillators;
    for (let i = 0; i < 20; i++) a.play('coin');
    expect(log.oscillators).toBe(once);
  });

  it('respects the sound effects toggle', () => {
    const log = installFakeAudio();
    vi.useFakeTimers();
    const a = new AudioEngine({ sfx: false, music: false });
    a.unlock();
    a.play('gift');
    expect(log.oscillators).toBe(0);
    a.applySettings({ sfx: true, music: false });
    a.play('gift');
    expect(log.oscillators).toBeGreaterThan(0);
  });

  it('starts and stops the music scheduler with the toggle', () => {
    const log = installFakeAudio();
    vi.useFakeTimers();
    const a = new AudioEngine({ sfx: false, music: true });
    a.unlock();
    expect(log.oscillators).toBeGreaterThan(0); // first bar queued at once
    expect(vi.getTimerCount()).toBe(1);
    a.applySettings({ sfx: false, music: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
