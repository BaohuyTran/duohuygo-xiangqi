import { useEffect, useMemo, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { PuzzleList } from './components/PuzzleList';
import { PuzzlePlayer } from './components/PuzzlePlayer';
import { units, type Lesson, type Unit } from './content';
import { isNewCourseLessonId } from './content/release';
import { createGamification, lessonXp, type Gamification } from './gamification';
import { I18nProvider, isLanguage, useI18n } from './i18n/I18nProvider';
import { furthestLesson, jumpTest, lessonStates, skippedLessons } from './lessons/progress';
import { completedView } from './progress/legacy';
import { findPuzzle, nextPuzzle, puzzleNumber, puzzles } from './puzzles/catalog';
import { SoundProvider, useSound, type AudioContextLike } from './sound';
import type { AccountService } from './sync/service';
import {
  createGamificationRepository,
  createLearningRepository,
  createLocalStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  type KeyValueStore,
  type LearningRepository,
  type ProgressRepository,
  type PuzzleProgressRepository,
  type SettingsRepository,
} from './storage';

/** How often the stats (heart refills, day changes) are re-read while the app is open. */
const STATS_REFRESH_MS = 30_000;

export default function App({
  store,
  now,
  audio,
  account,
  course = units,
}: {
  store?: KeyValueStore;
  now?: () => Date;
  /** Audio backend factory for sound effects (tests inject a fake); defaults to Web Audio. */
  audio?: () => AudioContextLike | null;
  /**
   * Optional account login + sync (src/sync). When given, the app reads and writes through
   * `account.store` so local changes get synced. Absent: no account UI, plain local storage.
   */
  account?: AccountService;
  /** The units Home shows; defaults to the path of src/content (legacy path, or the course preview). Tests inject fixtures. */
  course?: readonly Unit[];
}) {
  const repos = useMemo(() => {
    const s = store ?? account?.store ?? createLocalStore();
    return {
      progress: createProgressRepository(s),
      learning: createLearningRepository(s),
      puzzles: createPuzzleProgressRepository(s),
      settings: createSettingsRepository(s),
      game: createGamification(createGamificationRepository(s), now),
    };
  }, [store, now, account]);
  const savedLang = repos.settings.language();

  return (
    <I18nProvider initial={isLanguage(savedLang) ? savedLang : 'en'} onChange={repos.settings.setLanguage}>
      <SoundProvider initialMuted={repos.settings.muted()} onMutedChange={repos.settings.setMuted} createContext={audio}>
        {account && <SyncedSettings account={account} settings={repos.settings} />}
        <Screens
          progress={repos.progress}
          learning={repos.learning}
          puzzleProgress={repos.puzzles}
          game={repos.game}
          account={account}
          course={course}
          now={now}
        />
      </SoundProvider>
    </I18nProvider>
  );
}

/** After a sync changed local data, applies a synced language / sound setting to the running app. */
function SyncedSettings({ account, settings }: { account: AccountService; settings: SettingsRepository }) {
  const { lang, setLang } = useI18n();
  const { muted, setMuted } = useSound();
  useEffect(
    () =>
      account.onDataChanged(() => {
        const stored = settings.language();
        if (isLanguage(stored) && stored !== lang) setLang(stored);
        if (settings.muted() !== muted) setMuted(settings.muted());
      }),
    [account, settings, lang, setLang, muted, setMuted],
  );
  return null;
}

function Screens({
  progress,
  learning,
  puzzleProgress,
  game,
  account,
  course,
  now = () => new Date(),
}: {
  progress: ProgressRepository;
  /** Three-level records (src/progress): new-course completion (course preview) and Reset. */
  learning: LearningRepository;
  puzzleProgress: PuzzleProgressRepository;
  game: Gamification;
  account?: AccountService;
  course: readonly Unit[];
  now?: () => Date;
}) {
  // Completed lessons as Home shows them: the v1 list (legacy lessons) plus the new-course records, including
  // completion derived from retired legacy lessons (src/progress/legacy.ts). Reading writes nothing.
  const readCompleted = () => {
    const v1 = progress.completedLessons();
    return [...new Set([...v1, ...completedView(learning.records(), v1).keys()])];
  };
  // New-course ids are never written to the v1 list (05-migration.md §8.7, T18): they go to the learning records.
  // `placement` stands in for a passed jump test until the new jump-ahead of 03 §7 exists (S2.13).
  const markDone = (lesson: Lesson, via: 'lesson' | 'placement') => {
    if (!isNewCourseLessonId(lesson.id)) {
      progress.markCompleted(lesson.id);
      return;
    }
    const contentVersion = Math.max(1, ...lesson.exercises.map((e) => e.version ?? 1));
    learning.grantCompletion(lesson.id, { at: now().toISOString(), via, contentVersion });
  };
  const [tab, setTab] = useState<Tab>('lessons');
  const [completed, setCompleted] = useState(readCompleted);
  const [solved, setSolved] = useState(() => new Set(puzzleProgress.solvedPuzzles()));
  const [lessonId, setLessonId] = useState<string | null>(null);
  // The lesson Home scrolls to when it next appears: the furthest lesson reached (on opening the app), or
  // the lesson / jump target just left. Cleared once Home has scrolled, so switching tabs does not jump.
  const [homeFocus, setHomeFocus] = useState<string | null>(() => furthestLesson(course, readCompleted()));
  const leaveLesson = (id: string) => {
    setHomeFocus(id);
    setLessonId(null);
  };
  // A running jump-ahead test: the locked lesson it unlocks and its exercises (fixed when it starts).
  const [jump, setJump] = useState<{ target: string; test: Lesson } | null>(null);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [stats, setStats] = useState(() => game.refresh());
  // XP awarded for the last solved puzzle, shown on its success screen.
  const [puzzleXp, setPuzzleXp] = useState<{ id: string; xp: number } | null>(null);

  // Hearts refill and days change with time: re-read the (timestamp-based) state periodically.
  useEffect(() => {
    const id = window.setInterval(() => setStats(game.refresh()), STATS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [game]);
  // A sync merged account data into the local store: re-read it (summary() does not write).
  useEffect(
    () =>
      account?.onDataChanged(() => {
        setCompleted(readCompleted());
        setSolved(new Set(puzzleProgress.solvedPuzzles()));
        setStats(game.summary());
      }),
    [account, progress, learning, puzzleProgress, game],
  );
  const states = useMemo(() => lessonStates(course, completed), [course, completed]);
  const lesson = lessonId ? course.flatMap((u) => u.lessons).find((l) => l.id === lessonId) : undefined;
  const puzzle = puzzleId ? findPuzzle(puzzleId) : undefined;

  if (jump) {
    return (
      <LessonPlayer
        key={jump.test.id}
        lesson={jump.test}
        test
        onExit={() => {
          setHomeFocus(jump.target);
          setJump(null);
        }}
        onComplete={() => {
          // Passing completes every skipped lesson, without XP; the target becomes available.
          for (const l of skippedLessons(course, jump.target, completed)) markDone(l, 'placement');
          setCompleted(readCompleted());
          setHomeFocus(jump.target);
          setJump(null);
        }}
      />
    );
  }

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
        onExit={() => leaveLesson(lesson.id)}
        onComplete={() => {
          game.completeLesson(firstCompletion);
          setStats(game.summary());
          markDone(lesson, 'lesson');
          setCompleted(readCompleted());
          leaveLesson(lesson.id);
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
          units={course}
          states={states}
          focusLessonId={homeFocus}
          onFocused={() => setHomeFocus(null)}
          stats={stats}
          account={account}
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
          onJump={(id) => {
            const test = jumpTest(course, id, completed);
            if (test) setJump({ target: id, test });
          }}
          onReset={() => {
            // Clears v1 completion (otherwise the derived legacy view would re-grant it), the learning records
            // and the attempt log (05 §8.5, MU3). Puzzles, settings and gamification are untouched.
            progress.reset();
            learning.reset();
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
