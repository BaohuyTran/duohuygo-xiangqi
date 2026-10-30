import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PlayExercise } from '../content/types';
import { findGeneral, isInCheck, legalMoves, makeMove, type Move, type Piece, type Position, type Square } from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import { positionOf } from '../lessons/answers';
import { moveKey } from '../lessons/decision';
import { PASS_MARK, scoringWeights, type CriticalFailure, type ScoreTerm } from '../assessment/rubrics';
import { PARTNER_REGIME, type PartnerRegime } from '../assessment/regime';
import type { TaskResult, TaskState } from '../assessment/practical';
import type { Analyzer } from '../play/policies';
import { deriveSeed } from '../play/rng';
import type { ApplicationGrant, FallbackRegime } from '../progress/records';
import type { PlayRepository } from '../storage';
import { moveSound, useSound } from '../sound';
import { Board } from './Board';
import { MovePicker } from './DecisionView';
import { FeedbackLine, FeedbackPanel, PrimaryButton } from './FeedbackPanel';
import { useElementHeight } from './useElementHeight';

type Engine = typeof import('../assessment/practical');

/** What a finished task reports to the lesson player (attempt record + the "applied" grant). */
export interface PlayReport {
  pass: boolean;
  score: number;
  voided: boolean;
  fallback: FallbackRegime | null;
  /** The 03 §5.6 grant of a passed, non-voided run (with its fallback), else null. */
  grant: ApplicationGrant | null;
  /** Every move of the game (move keys). */
  path: string[];
  values: Partial<Record<ScoreTerm, number>>;
  critical: CriticalFailure[];
  /** The line share gate failed (03 §5.3 rule 4). */
  gateFailed: boolean;
  /** Assessed runs of this item, the last one included unless it was voided (a voided run is not a retry, 03 §5.6). */
  runs: number;
  /** Voided runs (device fallback, unchecked facts, too few counted moves). */
  voidedRuns: number;
}

export interface PlayViewProps {
  exercise: PlayExercise;
  onDone: (report: PlayReport) => void;
  /** Seed of a new run (partner choices, tree replies). */
  seed: number;
  /**
   * Assessment run (jump test, check, placement, exam): the main authored replies, no coverage, and ONE run (03 §7.3
   * rule 4: no retry inside the test). Only a voided run may be replayed, once (03 §5.6); a second void ends the task.
   */
  test: boolean;
  /** Games in progress (src/storage `createPlayRepository`): a reload or a tab switch resumes the game. */
  store: PlayRepository;
  /** Partner regime (default `PARTNER_REGIME`: fallback until S2.18). */
  regime?: PartnerRegime;
  /** The analysis (default: the app's Worker client, loaded on first use). Tests pass `directAnalyzer()`. */
  analyzer?: () => Promise<Analyzer>;
  /** How often each continuation of a tree path was met before (from the local attempt log). */
  coverage?: (prefix: readonly string[]) => ReadonlyMap<string, number>;
  now?: () => Date;
}

type Phase = 'loading' | 'learner' | 'checking' | 'partner' | 'scoring' | 'done';
type Notice = { kind: 'refused' } | { kind: 'warn'; move: Move } | { kind: 'resumed' } | null;

const appAnalyzer = (): Promise<Analyzer> => import('../analysis/client').then((m) => m.getAnalysisClient());

/** The end-of-game sentence for the result panel (03 §5.5 outcome or the task's own end). */
function endText(t: ReturnType<typeof useI18n>['t'], state: TaskState, side: 'red' | 'black'): string {
  const end = state.end;
  if (!end) return '';
  if (end.reason === 'tree-end') return t('play.end.treeEnd');
  if (end.reason === 'leaf') return t('play.end.leaf');
  if (end.reason === 'partner-none') return t('play.end.partnerNone');
  const o = end.outcome;
  if (!o) return '';
  const name = (c: 'red' | 'black') => t(`color.${c}`);
  switch (o.reason) {
    case 'checkmate':
      return t(o.winner === side ? 'play.end.checkmate.win' : 'play.end.checkmate.loss');
    case 'stalemate':
      return t(o.winner === side ? 'play.end.stalemate.win' : 'play.end.stalemate.loss');
    case 'perpetual-check':
      return t('play.end.perpetualCheck', { side: name(o.checkers?.[0] ?? (o.winner === 'red' ? 'black' : 'red')) });
    case 'repetition-draw':
      return t('play.end.repetitionDraw');
    case 'task-cap':
      return t('play.end.taskCap');
    case 'move-cap':
    case 'no-capture':
      return `${t(o.reason === 'move-cap' ? 'play.end.moveCap' : 'play.end.noCapture')} ${o.winner ? t('play.end.trainingWin', { side: name(o.winner) }) : t('play.end.trainingDraw')}`;
  }
}

/**
 * A practical task (03-assessment.md §5): the learner plays a game against a training partner (an authored tree, then
 * the regime's chain) until mate, repetition, the cap or the end of the tree-bounded part (F1). Every learner move's
 * signals are computed in the analysis Worker during the game; the game is saved after every move (resumed on
 * reload). The result screen shows the rubric scores, pass / fail, critical failures, and "not assessed" for a voided
 * run (03 §5.6).
 */
export function PlayView({ exercise: ex, onDone, seed, test, store, regime = PARTNER_REGIME, analyzer, coverage, now = () => new Date() }: PlayViewProps) {
  const { t } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const side = ex.side ?? 'red';
  const taskId = ex.id ?? 'play';

  const [phase, setPhase] = useState<Phase>('loading');
  const [task, setTask] = useState<TaskState | null>(null);
  const [result, setResult] = useState<{ result: TaskResult; grant: ApplicationGrant | null } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [disclosures, setDisclosures] = useState<string[]>([]);
  /** Runs started on this screen (new games), assessed earlier runs and voided earlier runs. */
  const runs = useRef({ started: 0, assessed: 0, voided: 0 });
  const services = useRef<{ engine: Engine; analyzer: Analyzer } | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const deps = () => ({
    analyzer: services.current!.analyzer,
    fixedReplies: test,
    ...(coverage ? { coverage } : {}),
    now: () => now().getTime(),
  });

  const save = (s: TaskState) => {
    setTask(s);
    store.save(taskId, s);
  };

  /** From a state: score it, let the partner move, or wait for the learner. */
  const drive = async (s: TaskState): Promise<void> => {
    const { engine } = services.current!;
    let cur = s;
    while (alive.current && !cur.end) {
      const pos = engine.currentPosition(cur.record);
      if (pos.turn === cur.record.learner) {
        setPhase('learner');
        return;
      }
      setPhase('partner');
      const before = pos;
      const r = await engine.partnerTurn(ex, cur, deps());
      if (!alive.current) return;
      if (r.cancelled) {
        setPhase('learner');
        return;
      }
      const last = r.state.record.moves.at(-1);
      if (last && r.state.record.moves.length > cur.record.moves.length) play(moveSound(before, last.move));
      cur = r.state;
      save(cur);
    }
    if (!alive.current || !cur.end) return;
    setPhase('scoring');
    const res = await engine.finishTask(ex, cur, deps());
    if (!alive.current) return;
    store.clear(taskId);
    const grant = test ? null : engine.applicationGrant(ex, res, now().toISOString());
    setResult({ result: res, grant });
    setPhase('done');
    play(res.score.pass ? 'complete' : 'wrong', 0.12);
  };

  // Load the engine and the analysis, resume a saved game or start a new one.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([import('../assessment/practical'), (analyzer ?? appAnalyzer)()]).then(([engine, a]) => {
      if (cancelled || !alive.current) return;
      services.current = { engine, analyzer: a };
      setDisclosures(engine.disclosureKeys(ex, regime));
      const saved = engine.parseTaskState(store.load(taskId), ex, regime);
      const initial = saved ?? engine.startTask(ex, regime, seed);
      if (saved && saved.record.moves.length > 0) setNotice({ kind: 'resumed' });
      save(initial);
      void drive(initial);
    });
    return () => {
      cancelled = true;
    };
    // The task is set up once per item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playLearner = async (s: TaskState, move: Move) => {
    const { engine } = services.current!;
    setPhase('checking');
    const before = engine.currentPosition(s.record);
    play(moveSound(before, move));
    const next = await engine.learnerTurn(ex, s, move, deps());
    if (!alive.current) return;
    save(next);
    await drive(next);
  };

  const tryMove = async (move: Move) => {
    if (phase !== 'learner' || !task || !services.current) return;
    const { engine, analyzer: a } = services.current;
    const pos = engine.currentPosition(task.record);
    if (!legalMoves(pos).some((m) => m.from === move.from && m.to === move.to)) return;
    setSelected(null);
    setNotice(null);
    setPhase('checking');
    const v = await engine.checkLearnerMove(task.record, move, a, engine.guardOf(ex));
    if (!alive.current) return;
    if (!v.allowed) {
      if (v.reason === 'third-repetition') setNotice({ kind: 'refused' });
      setPhase('learner');
      return;
    }
    if ((v.exception === 'only-move' || v.exception === 'all-alternatives-fail-guard') && engine.losesByRepetition(task.record, move)) {
      setNotice({ kind: 'warn', move });
      setPhase('learner');
      return;
    }
    await playLearner(task, move);
  };

  const onSquareClick = (sq: Square) => {
    if (phase !== 'learner' || !task) return;
    const piece = pos.board[sq];
    if (piece && piece.color === pos.turn) {
      setSelected(sq === selected ? null : sq);
      return;
    }
    if (selected !== null) void tryMove({ from: selected, to: sq });
  };

  // ----- Board -----
  const moves = task?.record.moves ?? [];
  const pos: Position = useMemo(() => moves.reduce((p, m) => makeMove(p, m.move), start), [moves, start]);
  const last = moves.at(-1)?.move ?? null;
  const before = moves.length > 0 ? moves.slice(0, -1).reduce((p, m) => makeMove(p, m.move), start) : start;
  const victim = last ? before.board[last.to] : null;
  const dots = selected !== null && phase === 'learner' ? legalMoves(pos).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(pos) ? findGeneral(pos.board, pos.turn) : null;
  const learnerMoves = moves.filter((_, i) => (i % 2 === 0) === (start.turn === side)).length;

  const status =
    phase === 'loading'
      ? t('play.status.loading')
      : phase === 'partner'
        ? t('play.status.partner')
        : phase === 'checking'
          ? t('play.status.checking')
          : phase === 'scoring'
            ? t('play.status.scoring')
            : phase === 'done'
              ? ''
              : ex.task === 'game'
                ? t('play.status.yourMoveGame', { side: t(`color.${side}`), n: learnerMoves + 1 })
                : t('play.status.yourMove', { side: t(`color.${side}`), n: learnerMoves + 1, cap: ex.cap });

  // ----- Result panel -----
  let panel: { tone: 'correct' | 'incorrect' | 'neutral'; title: string; lines: { label?: string; text: string }[] } | null = null;
  if (phase === 'done' && result && task) {
    const s = result.result.score;
    const lines: { label?: string; text: string }[] = [{ text: endText(t, task, side) }];
    if (s.voided) {
      lines.push({ text: t(s.voids.length === 1 && s.voids[0] === 'line-share-window' ? 'play.run.voidedWindow' : 'play.run.voided') });
    } else {
      lines.push({ text: t('play.result.score', { score: s.score, pass: ex.passMark ?? PASS_MARK }) });
      for (const w of scoringWeights(ex.rubrics, result.result.fallback)) {
        const v = s.values[w.term];
        if (v !== undefined) lines.push({ text: t('play.result.term', { name: t(`play.result.${w.term}`), value: Math.round(v) }) });
      }
      for (const c of s.critical) lines.push({ text: t(`play.result.critical.${c}`) });
      if (s.gateFailed) lines.push({ text: t('play.result.gate') });
    }
    if (result.result.fallback) lines.push({ text: t('play.result.fallback', { f: result.result.fallback }) });
    if (ex.explanation) lines.push({ text: t(ex.explanation) });
    panel = {
      tone: s.voided ? 'neutral' : s.pass ? 'correct' : 'incorrect',
      title: t(s.voided ? 'play.result.voidedTitle' : s.pass ? 'play.result.pass' : 'play.result.fail'),
      lines,
    };
  } else if (notice?.kind === 'refused') {
    panel = { tone: 'neutral', title: t('play.refuse.thirdRepetition'), lines: [] };
  } else if (notice?.kind === 'warn') {
    panel = { tone: 'neutral', title: t('play.warn.ownPerpetualCheck'), lines: [] };
  }

  /** A failed or voided run: start again at once with a new seed (03 §5.6). A voided run is not counted as a retry. */
  const newGame = () => {
    if (!result || !services.current) return;
    const r = runs.current;
    if (result.result.score.voided) r.voided++;
    else r.assessed++;
    r.started++;
    const fresh = services.current.engine.startTask(ex, regime, deriveSeed(seed, r.started));
    setResult(null);
    setNotice(null);
    setSelected(null);
    save(fresh);
    void drive(fresh);
  };

  const finish = () => {
    if (!result || !task) return;
    const s = result.result.score;
    const r = runs.current;
    onDone({
      pass: s.pass,
      score: s.score,
      voided: s.voided,
      fallback: result.result.fallback,
      grant: result.grant,
      path: task.record.moves.map((m) => moveKey(m.move)),
      values: s.values,
      critical: s.critical,
      gateFailed: s.gateFailed,
      runs: r.assessed + (s.voided ? 0 : 1),
      voidedRuns: r.voided + (s.voided ? 1 : 0),
    });
  };

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.play')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-1 min-h-5 text-sm font-semibold text-stone-500" data-testid="play-status" aria-live="polite">
          {status}
        </p>
        {notice?.kind === 'resumed' && phase !== 'done' && (
          <p className="mb-1 text-sm font-semibold text-violet-700" data-testid="play-resumed">
            {t('play.resumed')}
          </p>
        )}
        {disclosures.length > 0 && phase !== 'done' && (
          <details className="mb-2 rounded-xl border-2 border-stone-200 bg-white/60" data-testid="play-disclosure">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold text-stone-600">{t('play.partner.title')}</summary>
            <div className="flex flex-col gap-1 px-3 pb-3 text-sm text-stone-600">
              {disclosures.map((k) => (
                <p key={k}>{t(k)}</p>
              ))}
            </div>
          </details>
        )}
        <div className="board-fit overflow-hidden rounded-xl shadow-md">
          <Board
            position={pos}
            selected={selected}
            dots={dots}
            lastMove={last}
            animateMove={last}
            captured={last && victim ? { at: last.to, piece: victim as Piece } : null}
            checkedGeneral={checked}
            onSquareClick={onSquareClick}
            orientation={side}
            fileNumbers
          />
        </div>
        {phase === 'learner' && !notice?.kind?.startsWith('warn') && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            <MovePicker key={moves.length} position={pos} onMove={(m) => void tryMove(m)} />
          </div>
        )}
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {panel && (
        <FeedbackPanel
          key={`${phase}-${notice?.kind ?? ''}`}
          panelRef={footerRef}
          tone={panel.tone}
          title={panel.title}
          actions={
            phase === 'done' ? (
              result && !result.result.score.pass && (!test || (result.result.score.voided && runs.current.voided === 0)) ? (
                <>
                  <PrimaryButton tone="red" onClick={newGame}>
                    {t('play.newGame')}
                  </PrimaryButton>
                  <PrimaryButton onClick={finish}>{t('lesson.continue')}</PrimaryButton>
                </>
              ) : (
                <PrimaryButton onClick={finish}>{t('lesson.continue')}</PrimaryButton>
              )
            ) : notice?.kind === 'warn' ? (
              <>
                <PrimaryButton
                  tone="red"
                  onClick={() => {
                    const m = notice.move;
                    setNotice(null);
                    if (task) void playLearner(task, m);
                  }}
                >
                  {t('play.warn.playAnyway')}
                </PrimaryButton>
                <PrimaryButton onClick={() => setNotice(null)}>{t('play.warn.chooseAnother')}</PrimaryButton>
              </>
            ) : (
              <PrimaryButton onClick={() => setNotice(null)}>{t('play.refuse.ok')}</PrimaryButton>
            )
          }
        >
          {panel.lines.map((line, i) => (
            <FeedbackLine key={i} label={line.label}>
              {line.text}
            </FeedbackLine>
          ))}
        </FeedbackPanel>
      )}
    </>
  );
}
