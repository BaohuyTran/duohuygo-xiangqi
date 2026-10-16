// Test helper: a fake AudioContext that records what was scheduled (Web Audio does not exist in Node/jsdom).
import type { AudioContextLike, OscillatorLike } from './player';

export interface FakeAudio {
  /** Pass as `createContext`. */
  factory: () => AudioContextLike;
  /** How many contexts were created. */
  created: () => number;
  /** How many times resume() was called. */
  resumed: () => number;
  /** Oscillators started so far (one per note). */
  started: () => { freq: number; when: number }[];
}

export function createFakeAudio(initialState: 'suspended' | 'running' = 'suspended'): FakeAudio {
  let created = 0;
  let resumed = 0;
  const started: { freq: number; when: number }[] = [];
  const param = () => {
    let value = 0;
    return {
      get value() {
        return value;
      },
      setValueAtTime(v: number) {
        value = v;
      },
      exponentialRampToValueAtTime() {},
    };
  };
  const factory = (): AudioContextLike => {
    created++;
    let state = initialState;
    return {
      currentTime: 10,
      get state() {
        return state;
      },
      destination: {},
      resume() {
        resumed++;
        state = 'running';
        return Promise.resolve();
      },
      createOscillator() {
        const frequency = param();
        const osc: OscillatorLike = {
          type: 'sine',
          frequency,
          connect: () => undefined,
          start: (when) => void started.push({ freq: frequency.value, when }),
          stop: () => {},
        };
        return osc;
      },
      createGain: () => ({ gain: param(), connect: () => undefined }),
    };
  };
  return { factory, created: () => created, resumed: () => resumed, started: () => [...started] };
}
