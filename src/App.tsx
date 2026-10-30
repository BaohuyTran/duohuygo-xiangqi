import { useEffect, useMemo, useReducer, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { AssessmentPlayer, type AssessmentRun } from './components/AssessmentPlayer';
import { checkOffer, checkRun, examRun, morePracticeLesson, placementOffer, placementRun, remediationLesson, warmUpRun, type RunContext } from './components/assessmentRuns';
import { Home, type JumpInfo, type LevelPanel, type UnitPanel } from './components/Home';
import { LessonPlayer, type LessonEvent } from './components/LessonPlayer';
import { PuzzleList } from './components/PuzzleList';
import { PuzzlePlayer } from './components/PuzzlePlayer';
import { COURSE_PREVIEW, units, type Lesson, type Unit } from './content';
import { allPools, servablePools } from './content/pools';
import { CURRENT_RELEASE, isNewCourseLessonId, isNewCourseUnitId, RELEASE_STATES, trackOf } from './content/release';
import type { AssessmentPool, Track } from './content/types';
import { lastCheckOutcome } from './assessment/checks';
import { levelProgress, unitProgress } from './assessment/exams';
import { PARTNER_REGIME } from './assessment/regime';
import { createGamification, lessonXp, type Gamification } from './gamification';
import { I18nProvider, isLanguage, useI18n } from './i18n/I18nProvider';
import { furthestLesson, jumpBannerTrack, jumpTest, lessonStates, levelOpen, skippedLessons } from './lessons/progress';
import { completedView } from './progress/legacy';
import { isFirstRealCompletion } from './progress/records';
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

/** Assessment pools the app may serve: published items (reviewed in the course preview) of the levels the path shows. */
const DEFAULT_POOLS = servablePools(allPools, { preview: COURSE_PREVIEW, state: RELEASE_STATES[CURRENT_RELEASE] });
/** PD-35: the gate applies to published new-course levels only (none in REL-0); legacy tracks keep today's rule. */
const DEFAULT_GATED: ReadonlySet<Track> = new Set(RELEASE_STATES[CURRENT_RELEASE].published);

export default function App({
  store,
  now,
  audio,
  account,
  course = units,
  pools = DEFAULT_POOLS,
  gatedLevels = DEFAULT_GATED,
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
  /** Served assessment pools (default: src/content/assessment filtered by status and level). Tests inject fixtures. */
  pools?: readonly AssessmentPool[];
  /** Levels behind the level entry gate (PD-35): the published new-course levels of the release state. */
  gatedLevels?: ReadonlySet<Track>;
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
          pools={pools}
          gatedLevels={gatedLevels}
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
  pools,
  gatedLevels,
  now = () => new Date(),
}: {
  progress: ProgressRepository;
  /** Three-level records (src/progress): new-course completion (course preview) and Reset. */
  learning: LearningRepository;
  puzzleProgress: PuzzleProgressRepository;
  game: Gamification;
  account?: AccountService;
  course: readonly Unit[];
  pools: readonly AssessmentPool[];
  gatedLevels: ReadonlySet<Track>;
  now?: () => Date;
}) {
  // Completed lessons as Home shows them: the v1 list (legacy lessons) plus the new-course records, including
  // completion derived from retired legacy lessons (src/progress/legacy.ts). Reading writes nothing.
  const readCompleted = () => {
    const v1 = progress.completedLessons();
    return [...new Set([...v1, ...completedView(learning.records(), v1).keys()])];
  };
  // New-course ids are never written to the v1 list (05-migration.md §8.7, T18): they go to the learning records.
  // `placement`: a passed jump-ahead (the J1/J2 placement of 03 §7, or today's jump test where no form exists).
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
  // A running assessment (unit check, placement, exam, warm-up; 03 §4, §6, §7) and the lesson Home returns to.
  const [assessment, setAssessment] = useState<{ run: AssessmentRun; back: string | null } | null>(null);
  // A practice run outside the lesson path: remediation of a failed check, or a unit's "more practice" pool.
  // `hearts`: "more practice" costs hearts like a lesson; remediation does not (it must stay possible at 0 hearts, so
  // the retake can always be unlocked).
  const [practice, setPractice] = useState<{ lesson: Lesson; back: string; hearts: boolean } | null>(null);
  const [warmUpDismissed, setWarmUpDismissed] = useState(false);
  // Bumped when the learning records change outside a lesson (assessment grants, sync): Home re-reads them.
  const [, refreshRecords] = useReducer((x: number) => x + 1, 0);
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 2 ** 32));
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
        refreshRecords();
      }),
    [account, progress, learning, puzzleProgress, game],
  );
  const states = useMemo(() => lessonStates(course, completed, gatedLevels), [course, completed, gatedLevels]);
  // Attempt, hint and applied events of the lesson player (03 §3.1, carry-over of S2.8/S2.12): the attempt record —
  // which carries the hints taken (count, ladder step, hint before the first answer) — goes to the local attempt log,
  // an "applied" grant to the records. Voided records are stored like the others; scoring never uses them.
  const onLessonEvent = (event: LessonEvent) => {
    if (event.type === 'attempt') learning.logAttempt(event.record);
    else if (event.type === 'applied') learning.grantApplication(event.taskId, event.grant);
  };
  const runCtx: RunContext = { units: course, pools, learning, completed: readCompleted, markDone, now, seed: sessionSeed, regime: PARTNER_REGIME };
  const unitOfLesson = (id: string) => course.find((u) => u.lessons.some((l) => l.id === id));
  // How a jump to a locked lesson works (03 §7, PD-35, 05 P5): legacy tracks keep today's jump test; new-course tracks
  // use the J2 test-out when the served pools can build a form (else today's jump test, as before any pool exists);
  // none inside Master or into a level the entry gate keeps closed.
  const jumpInfo = (lessonId: string): JumpInfo => {
    const unit = unitOfLesson(lessonId);
    if (!unit || !isNewCourseUnitId(unit.id)) return { kind: 'legacy' };
    const track = trackOf(unit);
    if (track === 'master') return { kind: 'master' };
    if (!levelOpen(course, track, completed, gatedLevels)) return { kind: 'closed' };
    const offer = placementOffer(runCtx, { kind: 'J2', target: lessonId }, learning.attempts());
    return offer.available ? { kind: 'J2', questions: offer.questions, practical: offer.practical, usedToday: offer.usedToday } : { kind: 'legacy' };
  };
  const lesson = lessonId ? course.flatMap((u) => u.lessons).find((l) => l.id === lessonId) : undefined;
  const puzzle = puzzleId ? findPuzzle(puzzleId) : undefined;

  if (assessment) {
    return (
      <AssessmentPlayer
        key={assessment.run.id}
        run={assessment.run}
        now={now}
        onRecord={(record) => {
          learning.logAttempt(record);
          learning.markExposed([record.itemId]);
        }}
        onExit={() => {
          setCompleted(readCompleted());
          refreshRecords();
          if (assessment.back) setHomeFocus(assessment.back);
          setAssessment(null);
        }}
      />
    );
  }

  if (practice) {
    // Practice outside the path (remediation, "more practice"): no XP, no completion; hearts only for "more practice".
    return (
      <LessonPlayer
        key={practice.lesson.id}
        lesson={practice.lesson}
        {...(practice.hearts
          ? {
              hearts: stats.hearts,
              onMistake: () => {
                game.loseHeart();
                setStats(game.summary());
              },
            }
          : {})}
        onEvent={onLessonEvent}
        attempts={learning.attempts}
        now={now}
        onExit={() => {
          setHomeFocus(practice.back);
          setPractice(null);
        }}
        onComplete={() => {
          setHomeFocus(practice.back);
          setPractice(null);
        }}
      />
    );
  }

  if (jump) {
    return (
      <LessonPlayer
        key={jump.test.id}
        lesson={jump.test}
        test
        onEvent={onLessonEvent}
        attempts={learning.attempts}
        now={now}
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
    // MU4 / PD-28: a new-course lesson completed only through migration still earns first-completion XP (10) the first
    // time it is really finished; legacy lessons keep the v1 rule.
    const firstCompletion = isNewCourseLessonId(lesson.id) ? isFirstRealCompletion(learning.records(), lesson.id) : !progress.completedLessons().includes(lesson.id);
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
        onEvent={onLessonEvent}
        attempts={learning.attempts}
        now={now}
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

  // New-course progress states for Home (03 §2, T16). Legacy units get no panel, so the legacy path is unchanged.
  const records = learning.records();
  const attempts = learning.attempts();
  const completedMap = completedView(records, progress.completedLessons());
  const newUnits = course.filter((u) => isNewCourseUnitId(u.id));
  const unitPanels = new Map<string, UnitPanel>(
    newUnits.map((u) => [
      u.id,
      {
        progress: unitProgress(u, completedMap, records),
        check: checkOffer(runCtx, u, attempts).kind,
        checkFailed: lastCheckOutcome(u.id, attempts) === 'failed',
        practice: (u.pool?.length ?? 0) > 0,
      },
    ]),
  );
  const levelPanels = new Map<Track, LevelPanel>();
  for (const track of new Set(newUnits.map(trackOf))) {
    if (!pools.some((p) => p.kind === 'exam' && p.level === track)) continue;
    const level = levelProgress(track, newUnits, completedMap, records);
    const allDone = newUnits.filter((u) => trackOf(u) === track).every((u) => u.lessons.every((l) => completed.includes(l.id)));
    levelPanels.set(track, { mastered: level.mastered, applied: level.applied, exam: allDone && examRun(runCtx, track) !== null });
  }
  const bannerTrack = jumpBannerTrack(course, completed);
  const j1 =
    bannerTrack && newUnits.some((u) => trackOf(u) === bannerTrack) ? placementOffer(runCtx, { kind: 'J1', target: bannerTrack }, attempts) : null;
  const warmUp = !warmUpDismissed && newUnits.length > 0 && warmUpRun(runCtx, attempts) !== null;

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
            const info = jumpInfo(id);
            if (info.kind === 'J2') {
              const run = placementRun(runCtx, { kind: 'J2', target: id });
              if (run && !info.usedToday) setAssessment({ run, back: id });
              return;
            }
            if (info.kind !== 'legacy') return;
            const test = jumpTest(course, id, completed);
            if (test) setJump({ target: id, test });
          }}
          jumpInfo={jumpInfo}
          unitPanels={unitPanels}
          levelPanels={levelPanels}
          placement={bannerTrack && j1?.available ? { track: bannerTrack, usedToday: j1.usedToday } : null}
          onPlacement={(track) => {
            const run = placementRun(runCtx, { kind: 'J1', target: track });
            if (run) setAssessment({ run, back: null });
          }}
          onCheck={(unitId) => {
            // Assessments cost no hearts and work at 0 hearts (03 §9).
            const run = checkRun(runCtx, unitId);
            if (run) setAssessment({ run, back: course.find((u) => u.id === unitId)?.lessons[0]?.id ?? null });
          }}
          onRemediate={(unitId) => {
            const unit = course.find((u) => u.id === unitId);
            const offer = unit ? checkOffer(runCtx, unit, learning.attempts()) : null;
            const lessonForSet = offer && offer.kind === 'remediation' ? remediationLesson(unitId, offer) : null;
            if (unit && lessonForSet) setPractice({ lesson: lessonForSet, back: unit.lessons[0].id, hearts: false });
          }}
          onPractice={(unitId) => {
            const unit = course.find((u) => u.id === unitId);
            const pool = unit ? morePracticeLesson(unit) : null;
            if (unit && pool && game.refresh().hearts > 0) setPractice({ lesson: pool, back: unit.lessons[0].id, hearts: true });
          }}
          onExam={(track) => {
            const run = examRun(runCtx, track);
            if (run) setAssessment({ run, back: null });
          }}
          warmUp={warmUp}
          onWarmUp={() => {
            const run = warmUpRun(runCtx, learning.attempts());
            setWarmUpDismissed(true);
            if (run) setAssessment({ run, back: null });
          }}
          onDismissWarmUp={() => setWarmUpDismissed(true)}
          onReset={() => {
            // Clears v1 completion (otherwise the derived legacy view would re-grant it), the learning records
            // and the attempt log (05 §8.5, MU3). Puzzles, settings and gamification are untouched.
            progress.reset();
            learning.reset();
            setCompleted([]);
            refreshRecords();
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
