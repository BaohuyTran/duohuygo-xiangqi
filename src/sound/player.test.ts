import { describe, expect, it } from 'vitest';
import { createFakeAudio } from './fake-audio';
import { EFFECTS, SOUND_EFFECTS, browserAudioContext, createSoundPlayer } from './player';

describe('sound player', () => {
  it('defines every effect with audible, well-formed notes', () => {
    for (const effect of SOUND_EFFECTS) {
      expect(EFFECTS[effect].length, effect).toBeGreaterThan(0);
      for (const tone of EFFECTS[effect]) {
        expect(tone.freq).toBeGreaterThan(20);
        expect(tone.duration).toBeGreaterThan(0);
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it('creates no audio context and plays nothing before a user gesture', () => {
    const audio = createFakeAudio();
    const player = createSoundPlayer({ isMuted: () => false, createContext: audio.factory });
    player.play('correct');
    expect(audio.created()).toBe(0);
    expect(audio.started()).toEqual([]);
  });

  it('creates and resumes the context on unlock, then plays each note of an effect', () => {
    const audio = createFakeAudio('suspended');
    const player = createSoundPlayer({ isMuted: () => false, createContext: audio.factory });
    player.unlock();
    player.unlock();
    expect(audio.created()).toBe(1);
    expect(audio.resumed()).toBe(1); // only resumed while suspended
    player.play('complete');
    expect(audio.started().map((n) => n.freq)).toEqual(EFFECTS.complete.map((t) => t.freq));
    expect(audio.started()[0].when).toBe(10); // currentTime of the fake
  });

  it('delays an effect', () => {
    const audio = createFakeAudio('running');
    const player = createSoundPlayer({ isMuted: () => false, createContext: audio.factory });
    player.unlock();
    player.play('move', 0.5);
    expect(audio.started()[0].when).toBeCloseTo(10.5);
  });

  it('when muted, never touches audio, not even on the first gesture', () => {
    const audio = createFakeAudio();
    let muted = true;
    const player = createSoundPlayer({ isMuted: () => muted, createContext: audio.factory });
    player.unlock();
    player.play('wrong');
    expect(audio.created()).toBe(0);
    // Unmuted later: the next gesture starts audio.
    muted = false;
    player.unlock();
    player.play('wrong');
    expect(audio.started()).toHaveLength(EFFECTS.wrong.length);
    // Muted again: silent, context left alone.
    muted = true;
    player.play('move');
    expect(audio.started()).toHaveLength(EFFECTS.wrong.length);
  });

  it('is a silent no-op where Web Audio is unavailable', () => {
    expect(browserAudioContext()).toBeNull(); // Node has no AudioContext
    let calls = 0;
    const player = createSoundPlayer({
      isMuted: () => false,
      createContext: () => {
        calls++;
        return null;
      },
    });
    player.unlock();
    player.unlock();
    expect(() => player.play('capture')).not.toThrow();
    expect(calls).toBe(1);
  });

  it('swallows audio errors', () => {
    const audio = createFakeAudio('running');
    const player = createSoundPlayer({
      isMuted: () => false,
      createContext: () => ({
        ...audio.factory(),
        createOscillator: () => {
          throw new Error('boom');
        },
      }),
    });
    player.unlock();
    expect(() => player.play('correct')).not.toThrow();
  });

  it('has no React or DOM imports', () => {
    const sources = import.meta.glob(['./player.ts'], { query: '?raw', import: 'default', eager: true });
    const src = Object.values(sources)[0] as string;
    expect(src).not.toMatch(/from\s+['"]react|document\.|window\./);
  });
});
