// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { parseSquare } from '../engine';
import { startPosition } from '../puzzles/logic';
import { puzzles } from '../puzzles/catalog';
import { createMemoryStore, createSettingsRepository } from '../storage';
import { createFakeAudio } from './fake-audio';
import { EFFECTS, type SoundEffect } from './player';

afterEach(cleanup);

// A real tap: pointerdown (the user gesture that may start audio), then click.
const tapEl = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.click(el);
};
const tap = (square: string) => tapEl(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const press = (name: string | RegExp) => tapEl(screen.getByRole('button', { name }));
const freqs = (effect: SoundEffect) => EFFECTS[effect].map((t) => t.freq);

describe('sound in the app', () => {
  it('starts no audio before the first gesture, then plays correct, wrong and complete sounds', () => {
    const audio = createFakeAudio();
    render(<App store={createMemoryStore()} audio={audio.factory} />);
    expect(audio.created()).toBe(0);

    press('The board (start)');
    expect(audio.created()).toBe(1);
    expect(audio.resumed()).toBe(1);
    expect(audio.started()).toEqual([]); // opening a lesson is silent

    press('Continue');
    press('Continue');
    press('Continue');
    tap('a0');
    press(/Check/);
    expect(audio.started().map((n) => n.freq)).toEqual(freqs('wrong'));
    press('Try again');
    for (const sq of ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2']) tap(sq);
    press(/Check/);
    expect(audio.started().slice(-2).map((n) => n.freq)).toEqual(freqs('correct'));
    press('Continue');
    expect(screen.getByText('Lesson complete!')).toBeTruthy();
    expect(screen.getByTestId('celebration')).toBeTruthy();
    expect(audio.started().slice(-4).map((n) => n.freq)).toEqual(freqs('complete'));
  });

  it('plays the move or capture and the completion sound when a puzzle is solved', () => {
    const audio = createFakeAudio('running');
    render(<App store={createMemoryStore()} audio={audio.factory} />);
    press('Puzzles');
    press(/^Puzzle 1, /);
    const p = puzzles[0];
    tap(p.solution[0].from);
    tap(p.solution[0].to);
    expect(screen.getByRole('alert').textContent).toMatch(/Solved!/);
    expect(screen.getByTestId('celebration')).toBeTruthy();
    const played = audio.started().map((n) => n.freq);
    const isCapture = startPosition(p).board[parseSquare(p.solution[0].to)] !== null;
    const moveFreqs = freqs(isCapture ? 'capture' : 'move');
    expect(played).toEqual([...moveFreqs, ...freqs('complete')]);
  });

  it('when muted was stored, not even the first tap touches audio', () => {
    const store = createMemoryStore();
    createSettingsRepository(store).setMuted(true);
    const audio = createFakeAudio();
    render(<App store={store} audio={audio.factory} />);
    expect(screen.getAllByRole('button', { name: 'Turn sound on' }).length).toBeGreaterThan(0);

    press('The board (start)');
    press('Continue');
    press('Continue');
    press('Continue');
    tap('a0');
    press(/Check/);
    expect(screen.getByRole('alert').textContent).toMatch(/Not quite/);
    expect(audio.created()).toBe(0);
    expect(audio.started()).toEqual([]);
  });

  it('the mute toggle is stored and silences sound immediately', () => {
    const store = createMemoryStore();
    const audio = createFakeAudio();
    render(<App store={store} audio={audio.factory} />);

    press('Turn sound off');
    expect(createSettingsRepository(store).muted()).toBe(true);
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeTruthy();

    press('The board (start)');
    press('Continue');
    press('Continue');
    press('Continue');
    tap('a0');
    press(/Check/);
    expect(audio.started()).toEqual([]);

    // Unmute from the lesson header: stored, and the next answer is heard.
    press('Turn sound on');
    expect(createSettingsRepository(store).muted()).toBe(false);
    press('Try again');
    tap('a0');
    press(/Check/);
    expect(audio.started().map((n) => n.freq)).toEqual(freqs('wrong'));

    // Remembered by a fresh app.
    press('Turn sound off');
    cleanup();
    render(<App store={store} audio={audio.factory} />);
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeTruthy();
  });

  it('is silent without Web Audio (jsdom has no AudioContext)', () => {
    render(<App store={createMemoryStore()} />);
    expect(() => press('The board (start)')).not.toThrow();
    expect(screen.getByRole('grid')).toBeTruthy();
  });
});
