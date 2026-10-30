// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Exercise, Lesson } from '../content/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import { holdFixture, openingFixture, reviewFixture } from '../assessment/play-fixtures';
import { directAnalyzer, type Analyzer } from '../play';
import type { AnalysisOutcome, AnalysisRequest } from '../analysis/requests';
import { createMemoryStore, createPlayRepository, type PlayRepository } from '../storage';
import { LessonPlayer, type LessonEvent } from './LessonPlayer';

afterEach(cleanup);

const en = (key: string, vars?: Record<string, string | number>) => translate('en', key, vars);
const tap = (square: string) => fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${square},`) }));
const play = (move: string) => {
  const [a, b] = move.split('-');
  tap(a);
  tap(b);
};
const NOW = new Date('2026-10-30T12:00:00.000Z');
const status = () => screen.getByTestId('play-status').textContent ?? '';

/** The direct analyzer with every move-signals request answered 'not-checked' (a run that must be voided). */
const noSignals: Analyzer = {
  run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
    if (request.kind === 'move-signals') return Promise.resolve({ status: 'not-checked', kind: request.kind, reason: 'timeout', nodes: 0 } as AnalysisOutcome<R['kind']>);
    return directAnalyzer().run(request);
  },
};

function renderTask(exercise: Exercise, store: PlayRepository, events: LessonEvent[] = [], analyzer: Analyzer = directAnalyzer()) {
  const lesson: Lesson = { id: 'b10l9', title: 'u1l1.title', exercises: [exercise] };
  return render(
    <I18nProvider initial="en">
      <LessonPlayer
        lesson={lesson}
        onComplete={() => {}}
        onExit={() => {}}
        onEvent={(e) => events.push(e)}
        now={() => NOW}
        seed={1}
        playStore={store}
        playAnalyzer={() => Promise.resolve(analyzer)}
      />
    </I18nProvider>,
  );
}

describe('PlayView (practical tasks)', () => {
  it('discloses the partner, plays the task, shows the score and reports the attempt and the grant with its fallback', async () => {
    const store = createPlayRepository(createMemoryStore());
    const events: LessonEvent[] = [];
    renderTask(holdFixture(), store, events);
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 1, cap: 6 })));
    expect(screen.getByTestId('play-disclosure').textContent).toContain(en('play.partner.general'));
    expect(screen.getByTestId('play-disclosure').textContent).toContain(en('play.partner.forcingAttack'));
    expect(store.load('b10l9-01')).not.toBeNull();
    play('c5-c6');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(en('play.result.pass')), { timeout: 10_000 });
    const alert = screen.getByRole('alert').textContent ?? '';
    expect(alert).toContain(en('play.end.leaf'));
    expect(alert).toContain(en('play.result.score', { score: 100, pass: 75 }));
    expect(alert).toContain(en('play.result.fallback', { f: 'F1' }));
    expect(store.load('b10l9-01')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en('lesson.continue') }));
    const attempt = events.find((e) => e.type === 'attempt');
    expect(attempt).toMatchObject({ type: 'attempt', record: { itemId: 'b10l9-01', credit: 1, score: 100, fallback: 'F1', path: ['c5-c6'] } });
    expect(events.find((e) => e.type === 'applied')).toEqual({
      type: 'applied',
      taskId: 'b10l9-01',
      grant: { at: NOW.toISOString(), via: 'practical', score: 100, taskVersion: 1, fallback: 'F1' },
    });
  });

  it('a game in progress survives a reload (or a tab switch): it resumes from the stored state', async () => {
    const store = createPlayRepository(createMemoryStore());
    const first = renderTask(openingFixture(), store);
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 1, cap: 8 })));
    play('h0-g2');
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 2, cap: 8 })), { timeout: 10_000 });
    const saved = store.load('b10l9-02') as { record: { moves: unknown[] } };
    expect(saved.record.moves).toHaveLength(2);
    first.unmount();
    renderTask(openingFixture(), store);
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 2, cap: 8 })));
    expect(screen.getByTestId('play-resumed').textContent).toBe(en('play.resumed'));
    // The Horse is on g2 on the resumed board.
    expect(screen.getByRole('gridcell', { name: /^g2,/ }).getAttribute('aria-label')).toMatch(/Horse/i);
  }, 30_000);
});

describe('PlayView: voided and failed runs', () => {
  it('a voided run offers a new game with a new seed; it is not counted as a retry and grants nothing', async () => {
    const store = createPlayRepository(createMemoryStore());
    const events: LessonEvent[] = [];
    renderTask(holdFixture(), store, events, noSignals);
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 1, cap: 6 })));
    const firstSeed = (store.load('b10l9-01') as { seed: number }).seed;
    play('c5-c6');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(en('play.result.voidedTitle')), { timeout: 10_000 });
    expect(screen.getByRole('alert').textContent).toContain(en('play.run.voided'));
    fireEvent.click(screen.getByRole('button', { name: en('play.newGame') }));
    await waitFor(() => expect(status()).toBe(en('play.status.yourMove', { side: 'Red', n: 1, cap: 6 })));
    expect((store.load('b10l9-01') as { seed: number }).seed).not.toBe(firstSeed);
    play('c5-c6');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(en('play.result.voidedTitle')), { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: en('lesson.continue') }));
    expect(events.find((e) => e.type === 'attempt')).toMatchObject({ record: { itemId: 'b10l9-01', credit: 0, voided: true, runs: 0, voidedRuns: 2 } });
    expect(events.some((e) => e.type === 'applied')).toBe(false);
  }, 30_000);
});

describe('ReviewView', () => {
  it('mark the turning point, play a better move, choose the reason: R7 = 100', async () => {
    const events: LessonEvent[] = [];
    renderTask(reviewFixture(), createPlayRepository(createMemoryStore()), events);
    const moves = screen.getByTestId('review-moves');
    const buttons = moves.querySelectorAll('button');
    expect(buttons).toHaveLength(3); // the learner's three moves
    fireEvent.click(buttons[1]); // move 3: h2-h5
    fireEvent.click(screen.getByRole('button', { name: en('review.mark') }));
    expect(screen.getByTestId('review-step').textContent).toBe(en('review.step.better'));
    play('b0-c2');
    fireEvent.click(screen.getByRole('radio', { name: en('review.reason.allowed-loss') }));
    fireEvent.click(screen.getByRole('button', { name: en('review.confirm') }));
    const alert = screen.getByRole('alert').textContent ?? '';
    expect(alert).toContain(en('play.result.pass'));
    expect(alert).toContain(en('play.result.score', { score: 100, pass: 75 }));
    fireEvent.click(screen.getByRole('button', { name: en('lesson.continue') }));
    expect(events.find((e) => e.type === 'attempt')).toMatchObject({ record: { itemId: 'b10l9-05', credit: 1, score: 100, markedPly: 2, reason: 'allowed-loss' } });
  });

  it('a wrong turning point scores 0 for the mark, the better move and the reason, and names the right one', async () => {
    renderTask(reviewFixture(), createPlayRepository(createMemoryStore()));
    fireEvent.click(screen.getByTestId('review-moves').querySelectorAll('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: en('review.mark') }));
    play('b0-c2');
    fireEvent.click(screen.getByRole('radio', { name: en('review.reason.missed-gain') }));
    fireEvent.click(screen.getByRole('button', { name: en('review.confirm') }));
    const alert = screen.getByRole('alert').textContent ?? '';
    expect(alert).toContain(en('play.result.fail'));
    expect(alert).toContain(en('play.result.score', { score: 0, pass: 75 }));
    expect(alert).toMatch(/The turning point was move 3/);
  });
});
