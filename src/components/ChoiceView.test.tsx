// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../content/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { translate } from '../i18n/messages';
import { itemSeed, shuffleOptions } from '../lessons/choice';
import { choiceFixture } from '../lessons/test-fixtures';
import { LessonPlayer, type LessonEvent } from './LessonPlayer';

afterEach(cleanup);

const en = (key: string) => translate('en', key);
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const NOW = new Date('2026-10-23T12:00:00.000Z');
const SEED = 42;

function renderChoice(exercises: Exercise[], lang: 'en' | 'vi' = 'en') {
  const onMistake = vi.fn();
  const events: LessonEvent[] = [];
  render(
    <I18nProvider initial={lang}>
      <LessonPlayer
        lesson={{ id: 'b09l3', title: 'u1l1.title', exercises }}
        hearts={5}
        onMistake={onMistake}
        onComplete={() => {}}
        onExit={() => {}}
        onEvent={(e) => events.push(e)}
        now={() => NOW}
        seed={SEED}
      />
    </I18nProvider>,
  );
  return { onMistake, events };
}
const optionsShown = (role: 'radio' | 'checkbox') =>
  within(screen.getByTestId('choice-options'))
    .getAllByRole(role)
    .map((b) => b.getAttribute('data-option'));
const option = (id: string) => screen.getByTestId('choice-options').querySelector(`[data-option="${id}"]`) as HTMLElement;

describe('ChoiceView (through LessonPlayer)', () => {
  it('shows the options in the seeded order, "none" fixed last, moves in traditional notation', () => {
    renderChoice([choiceFixture()]);
    const expected = shuffleOptions(choiceFixture().options, itemSeed(SEED, 'b09l3-05')).map((o) => o.id);
    expect(optionsShown('radio')).toEqual(expected);
    expect(expected[3]).toBe('none');
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(option('a').textContent).toContain('H8+7');
    expect(option('b').textContent).toContain('R1+5');
  });

  it('a wrong pick shows that option’s feedback, costs a heart and tags its misconception; then the key solves it', () => {
    const { onMistake, events } = renderChoice([choiceFixture()]);
    expect(screen.getByRole('button', { name: 'Check' })).toHaveProperty('disabled', true);
    fireEvent.click(option('b'));
    expect(option('b').getAttribute('aria-checked')).toBe('true');
    press('Check');
    expect(screen.getByRole('alert').textContent).toMatch(/Not quite.*You lost a heart\. 4 left\./);
    expect(screen.getByTestId('option-feedback-b').textContent).toContain(en('u2l1.e2'));
    // The key is not revealed before the retry.
    expect(screen.queryByTestId('option-feedback-a')).toBeNull();
    expect(onMistake).toHaveBeenCalledOnce();
    press('Try again');
    expect(option('b').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(option('a'));
    press('Check');
    expect(screen.getByRole('alert').textContent).toContain('Correct!');
    expect(screen.getByTestId('option-feedback-a').textContent).toContain(en('u2l1.e1'));
    press('Continue');
    const record = events.find((e) => e.type === 'attempt');
    expect(record && record.type === 'attempt' && record.record).toEqual({
      itemId: 'b09l3-05',
      itemVersion: 2,
      mode: 'practice',
      at: NOW.toISOString(),
      colour: 'red',
      credit: 0,
      hints: 0,
      attemptsBeforeSuccess: 1,
      seed: itemSeed(SEED, 'b09l3-05'),
      misconception: 'b09.m2',
    });
  });

  it('multi-select: checkboxes, exact set; missing a correct option is wrong', () => {
    const { onMistake } = renderChoice([choiceFixture(true)]);
    expect(optionsShown('checkbox')).toHaveLength(4);
    fireEvent.click(option('a'));
    press('Check');
    expect(screen.getByRole('alert').textContent).toContain(en('choice.missedSome'));
    expect(onMistake).toHaveBeenCalledOnce();
    press('Try again');
    fireEvent.click(option('a'));
    fireEvent.click(option('c'));
    fireEvent.click(option('b'));
    fireEvent.click(option('b')); // toggled off again
    press('Check');
    expect(screen.getByRole('alert').textContent).toContain('Correct!');
  });

  it('works with the keyboard: digit keys pick the n-th option shown, options are focusable buttons', () => {
    renderChoice([choiceFixture()]);
    const shown = optionsShown('radio');
    const first = option(shown[0]!);
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: '2' });
    expect(option(shown[1]!).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(window, { key: String(shown.indexOf('a') + 1) });
    expect(option('a').getAttribute('aria-checked')).toBe('true');
    expect(option(shown[1]!).getAttribute('aria-checked')).toBe(shown[1] === 'a' ? 'true' : 'false');
    fireEvent.keyDown(window, { key: '9' }); // out of range: ignored
    press('Check');
    expect(screen.getByRole('alert').textContent).toContain('Correct!');
    // After answering, digits change nothing.
    fireEvent.keyDown(window, { key: '1' });
    expect(option('a').getAttribute('aria-checked')).toBe('true');
  });

  it('is fully translated in Vietnamese', () => {
    renderChoice([choiceFixture()], 'vi');
    expect(screen.getByText(translate('vi', 'lesson.type.choice'))).toBeTruthy();
    expect(screen.getByText(translate('vi', 'choice.pickOne'))).toBeTruthy();
    expect(option('a').textContent).toContain('M8.7');
  });
});
