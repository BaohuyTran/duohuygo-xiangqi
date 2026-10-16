// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GamificationSummary } from '../gamification';
import { I18nProvider } from '../i18n/I18nProvider';
import { StatsBar } from './StatsBar';

afterEach(cleanup);

const base: GamificationSummary = {
  totalXp: 120,
  todayXp: 15,
  dailyGoal: 20,
  goalMet: false,
  streak: 3,
  bestStreak: 7,
  hearts: 2,
  maxHearts: 5,
  nextHeartInMs: 12.5 * 60 * 1000,
};

function renderBar(summary: Partial<GamificationSummary> = {}, onGoalChange?: (g: 10 | 20 | 30 | 50) => void, lang: 'en' | 'vi' = 'en') {
  render(
    <I18nProvider initial={lang}>
      <StatsBar summary={{ ...base, ...summary }} onGoalChange={onGoalChange} />
    </I18nProvider>,
  );
}

describe('StatsBar', () => {
  it('shows the streak, today’s XP against the goal, hearts and the next heart', () => {
    renderBar();
    const bar = screen.getByRole('region', { name: 'Your stats' });
    expect(bar.textContent).toMatch(/3-day streak/);
    expect(screen.getByText('Today: 15 of 20 XP')).toBeTruthy();
    expect(screen.getByText('15/20 XP')).toBeTruthy();
    expect(screen.getByText('2 of 5 hearts')).toBeTruthy();
    expect(screen.getByText('Next heart in 13 min')).toBeTruthy();
    expect(screen.queryByText('Daily goal reached!')).toBeNull();
  });

  it('hides the refill time when hearts are full and celebrates a met goal', () => {
    renderBar({ hearts: 5, nextHeartInMs: null, todayXp: 25, goalMet: true });
    expect(screen.queryByText(/Next heart/)).toBeNull();
    expect(screen.getByText('Daily goal reached!')).toBeTruthy();
  });

  it('is read-only without onGoalChange (puzzle list)', () => {
    renderBar();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets the player change the daily goal', () => {
    const onGoalChange = vi.fn();
    renderBar({}, onGoalChange);
    const toggle = screen.getByRole('button', { name: /Change daily goal/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: '20 XP per day' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Best streak: 7 days')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '50 XP per day' }));
    expect(onGoalChange).toHaveBeenCalledWith(50);
  });

  it('speaks Vietnamese', () => {
    renderBar({}, undefined, 'vi');
    expect(screen.getByText('Hôm nay: 15/20 XP')).toBeTruthy();
    expect(screen.getByText('Tim tiếp theo sau 13 phút')).toBeTruthy();
  });
});
