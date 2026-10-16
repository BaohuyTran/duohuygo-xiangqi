import { useEffect, useMemo, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { PuzzleList } from './components/PuzzleList';
import { PuzzlePlayer } from './components/PuzzlePlayer';
import { findLesson, units } from './content';
import { createGamification, lessonXp, type Gamification } from './gamification';
import { I18nProvider, isLanguage } from './i18n/I18nProvider';
import { lessonStates } from './lessons/progress';
import { findPuzzle, nextPuzzle, puzzleNumber, puzzles } from './puzzles/catalog';
import { SoundProvider, type AudioContextLike } from './sound';
import {
  createGamificationRepository,
  createLocalStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  type KeyValueStore,
  type ProgressRepository,
  type PuzzleProgressRepository,
} from './storage';

/** How often the stats (heart refills, day changes) are re-read while the app is open. */
const STATS_REFRESH_MS = 30_000;

export default function App({
  store,
  now,
  audio,
}: {
  store?: KeyValueStore;
  now?: () => Date;
  /** Audio backend factory for sound effects (tests inject a fake); defaults to Web Audio. */
  audio?: () => AudioContextLike | null;
}) {
  const repos = useMemo(() => {
    const s = store ?? createLocalStore();
    return {
      progress: createProgressRepository(s),
      puzzles: createPuzzleProgressRepository(s),
      settings: createSettingsRepository(s),
      game: createGamification(createGamificationRepository(s), now),
    };
  }, [store, now]);
  const savedLang = repos.settings.language();

  return (
    <I18nProvider initial={isLanguage(savedLang) ? savedLang : 'en'} onChange={repos.settings.setLanguage}>
      <SoundProvider initialMuted={repos.settings.muted()} onMutedChange={repos.settings.setMuted} createContext={audio}>
        <Screens progress={repos.progress} puzzleProgress={repos.puzzles} game={repos.game} />
      </SoundProvider>
    </I18nProvider>
  );
}

function Screens({
  progress,
  puzzleProgress,
  game,
}: {
  progress: ProgressRepository;
  puzzleProgress: PuzzleProgressRepository;
  game: Gamification;
}) {
  const [tab, setTab] = useState<Tab>('lessons');
  const [completed, setCompleted] = useState(() => progress.completedLessons());
  const [solved, setSolved] = useState(() => new Set(puzzleProgress.solvedPuzzles()));
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [stats, setStats] = useState(() => game.refresh());
  // XP awarded for the last solved puzzle, shown on its success screen.
  const [puzzleXp, setPuzzleXp] = useState<{ id: string; xp: number } | null>(null);

  // Hearts refill and days change with time: re-read the (timestamp-based) state periodically.
  useEffect(() => {
    const id = window.setInterval(() => setStats(game.refresh()), STATS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [game]);
  const states = useMemo(() => lessonStates(units, completed), [completed]);
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  const puzzle = puzzleId ? findPuzzle(puzzleId) : undefined;

  if (lesson) {
    const firstCompletion = !completed.includes(lesson.id);
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        hearts={stats.hearts}
        completionXp={lessonXp(firstCompletion)}
        onMistake={() => {
          game.loseHeart();
          setStats(game.summary());
        }}
        onExit={() => setLessonId(null)}
        onComplete={() => {
          game.completeLesson(firstCompletion);
          setStats(game.summary());
          setCompleted(progress.markCompleted(lesson.id));
          setLessonId(null);
        }}
      />
    );
  }

  if (puzzle) {
    const next = nextPuzzle(puzzle.id, solved);
    return (
      <PuzzlePlayer
        key={puzzle.id}
        puzzle={puzzle}
        number={puzzleNumber(puzzle.id)}
        hasNext={next !== null}
        onExit={() => {
          setPuzzleXp(null);
          setPuzzleId(null);
        }}
        xpEarned={puzzleXp?.id === puzzle.id ? puzzleXp.xp : undefined}
        onSolved={(id) => {
          setPuzzleXp({ id, xp: game.solvePuzzle(!solved.has(id)) });
          setStats(game.summary());
          setSolved(new Set(puzzleProgress.markSolved(id)));
        }}
        onNext={() => {
          setPuzzleXp(null);
          setPuzzleId(nextPuzzle(puzzle.id, solved)?.id ?? null);
        }}
      />
    );
  }

  return (
    <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {tab === 'lessons' ? (
        <Home
          units={units}
          states={states}
          stats={stats}
          onGoalChange={(goal) => {
            game.setDailyGoal(goal);
            setStats(game.summary());
          }}
          onStart={(id) => {
            // With 0 hearts no lesson can be started; Home explains when the next heart arrives.
            if (states.get(id) === 'locked') return;
            const fresh = game.refresh();
            setStats(fresh);
            if (fresh.hearts > 0) setLessonId(id);
          }}
          onReset={() => {
            progress.reset();
            setCompleted([]);
          }}
        />
      ) : (
        <PuzzleList
          puzzles={puzzles}
          solved={solved}
          stats={stats}
          onOpen={(id) => {
            setPuzzleXp(null);
            setPuzzleId(id);
          }}
        />
      )}
      <BottomNav
        tab={tab}
        onChange={(next) => {
          setTab(next);
          setStats(game.refresh());
        }}
      />
    </div>
  );
}
