import { useMemo, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { PuzzleList } from './components/PuzzleList';
import { PuzzlePlayer } from './components/PuzzlePlayer';
import { findLesson, units } from './content';
import { I18nProvider, isLanguage } from './i18n/I18nProvider';
import { lessonStates } from './lessons/progress';
import { findPuzzle, nextPuzzle, puzzleNumber, puzzles } from './puzzles/catalog';
import {
  createLocalStore,
  createProgressRepository,
  createPuzzleProgressRepository,
  createSettingsRepository,
  type KeyValueStore,
  type ProgressRepository,
  type PuzzleProgressRepository,
} from './storage';

export default function App({ store }: { store?: KeyValueStore }) {
  const repos = useMemo(() => {
    const s = store ?? createLocalStore();
    return {
      progress: createProgressRepository(s),
      puzzles: createPuzzleProgressRepository(s),
      settings: createSettingsRepository(s),
    };
  }, [store]);
  const savedLang = repos.settings.language();

  return (
    <I18nProvider initial={isLanguage(savedLang) ? savedLang : 'en'} onChange={repos.settings.setLanguage}>
      <Screens progress={repos.progress} puzzleProgress={repos.puzzles} />
    </I18nProvider>
  );
}

function Screens({ progress, puzzleProgress }: { progress: ProgressRepository; puzzleProgress: PuzzleProgressRepository }) {
  const [tab, setTab] = useState<Tab>('lessons');
  const [completed, setCompleted] = useState(() => progress.completedLessons());
  const [solved, setSolved] = useState(() => new Set(puzzleProgress.solvedPuzzles()));
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const states = useMemo(() => lessonStates(units, completed), [completed]);
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  const puzzle = puzzleId ? findPuzzle(puzzleId) : undefined;

  if (lesson) {
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        onExit={() => setLessonId(null)}
        onComplete={() => {
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
        onExit={() => setPuzzleId(null)}
        onSolved={(id) => setSolved(new Set(puzzleProgress.markSolved(id)))}
        onNext={() => setPuzzleId(nextPuzzle(puzzle.id, solved)?.id ?? null)}
      />
    );
  }

  return (
    <div className="pb-24">
      {tab === 'lessons' ? (
        <Home
          units={units}
          states={states}
          onStart={(id) => {
            if (states.get(id) !== 'locked') setLessonId(id);
          }}
          onReset={() => {
            progress.reset();
            setCompleted([]);
          }}
        />
      ) : (
        <PuzzleList puzzles={puzzles} solved={solved} onOpen={setPuzzleId} />
      )}
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
