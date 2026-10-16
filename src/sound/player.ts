// Sound effects synthesized in code with the Web Audio API: no audio files, so no licences to track.
//
// Browser autoplay rules: an AudioContext may only be created/resumed from a user gesture. So the
// context is created lazily in `unlock()`, which the app calls from pointerdown/keydown listeners,
// and `play()` is silent until that has happened. When muted, `unlock()` does nothing at all, so a
// stored "muted" setting means not even the first tap touches the audio hardware.
// Where Web Audio does not exist (Node, jsdom, old browsers) everything is a silent no-op.
//
// No React or DOM imports here (the backend is injected), so the module is unit-testable.

export type SoundEffect = 'correct' | 'wrong' | 'move' | 'capture' | 'complete';

export const SOUND_EFFECTS: readonly SoundEffect[] = ['correct', 'wrong', 'move', 'capture', 'complete'];

/** One synthesized note. Times are in seconds from the moment the effect starts. */
export interface Tone {
  freq: number;
  /** Optional pitch glide to this frequency by the end of the note. */
  slideTo?: number;
  start: number;
  duration: number;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  /** Peak volume, 0..1. */
  gain: number;
}

export const EFFECTS: Record<SoundEffect, readonly Tone[]> = {
  // Short wooden "tock" of a piece being placed.
  move: [{ freq: 520, slideTo: 260, start: 0, duration: 0.08, type: 'triangle', gain: 0.35 }],
  // Two knocks: the captured piece is struck, then replaced.
  capture: [
    { freq: 300, slideTo: 140, start: 0, duration: 0.09, type: 'square', gain: 0.18 },
    { freq: 620, slideTo: 300, start: 0.07, duration: 0.09, type: 'triangle', gain: 0.35 },
  ],
  // Rising major third.
  correct: [
    { freq: 659.25, start: 0, duration: 0.12, type: 'sine', gain: 0.3 },
    { freq: 830.61, start: 0.1, duration: 0.2, type: 'sine', gain: 0.3 },
  ],
  // Low falling buzz.
  wrong: [
    { freq: 220, slideTo: 150, start: 0, duration: 0.16, type: 'sawtooth', gain: 0.12 },
    { freq: 180, slideTo: 110, start: 0.14, duration: 0.22, type: 'sawtooth', gain: 0.12 },
  ],
  // Major arpeggio up to the octave.
  complete: [
    { freq: 523.25, start: 0, duration: 0.14, type: 'triangle', gain: 0.3 },
    { freq: 659.25, start: 0.12, duration: 0.14, type: 'triangle', gain: 0.3 },
    { freq: 783.99, start: 0.24, duration: 0.14, type: 'triangle', gain: 0.3 },
    { freq: 1046.5, start: 0.36, duration: 0.4, type: 'triangle', gain: 0.32 },
  ],
};

// The small part of the Web Audio API that is used, so tests can pass a fake.
export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: never): unknown;
}
export interface OscillatorLike extends AudioNodeLike {
  type: Tone['type'];
  frequency: AudioParamLike;
  start(when: number): void;
  stop(when: number): void;
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

/** Creates the real AudioContext, or null where Web Audio is not available. */
export function browserAudioContext(): AudioContextLike | null {
  const g = globalThis as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export interface SoundPlayer {
  /** Call from a user gesture: creates/resumes the audio context unless muted. */
  unlock(): void;
  /** Plays an effect (optionally `delay` seconds later). Silent when muted or before `unlock()`. */
  play(effect: SoundEffect, delay?: number): void;
}

export interface SoundPlayerOptions {
  isMuted: () => boolean;
  /** Audio backend factory; defaults to the browser's AudioContext. */
  createContext?: () => AudioContextLike | null;
}

const SILENT = 0.0001;

export function createSoundPlayer({ isMuted, createContext = browserAudioContext }: SoundPlayerOptions): SoundPlayer {
  let ctx: AudioContextLike | null = null;
  let unavailable = false;

  const scheduleTone = (c: AudioContextLike, tone: Tone, at: number) => {
    const t0 = at + tone.start;
    const t1 = t0 + tone.duration;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(tone.slideTo, t1);
    gain.gain.setValueAtTime(SILENT, t0);
    gain.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(SILENT, t1);
    osc.connect(gain as never);
    gain.connect(c.destination as never);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  };

  return {
    unlock() {
      if (isMuted() || unavailable) return;
      if (!ctx) {
        ctx = createContext();
        if (!ctx) {
          unavailable = true;
          return;
        }
      }
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {});
    },
    play(effect, delay = 0) {
      if (isMuted() || !ctx) return;
      try {
        const at = ctx.currentTime + Math.max(0, delay);
        for (const tone of EFFECTS[effect]) scheduleTone(ctx, tone, at);
      } catch {
        // Audio problems must never break the app.
      }
    },
  };
}
