import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LineExercise, LineLearnerNode, LineLeaf, LineOpponentNode, MoveClass, MoveTableEntry } from '../content/types';
import { findGeneral, isInCheck, legalMoves, makeMove, type Move, type Piece, type Position, type Square } from '../engine';
import { useI18n } from '../i18n/I18nProvider';
import { legality, positionOf, type HintStep, type MoveVerdict } from '../lessons/answers';
import { isAccepted, moveKey, parseMoveKey, type Refutation } from '../lessons/decision';
import {
  chooseReply,
  isLeaf,
  judgeLineMove,
  keyToMove,
  lineCredit,
  lineGuard,
  pathKeys,
  type DefaultClass,
  type LineJudge,
  type LineStep,
} from '../lessons/line';
import { deriveSeed } from '../play/rng';
import { formatMove } from '../notation/format';
import { moveSound, useSound } from '../sound';
import { Board, type MarkTone } from './Board';
import { MovePicker, type ItemViewProps } from './DecisionView';
import { FeedbackLine, FeedbackPanel, PrimaryButton } from './FeedbackPanel';
import { useElementHeight } from './useElementHeight';

/** Delay before the opponent's authored reply (as in combinations). */
export const LINE_REPLY_MS = 650;

/** What a finished line reports to the lesson player (03-assessment.md §3.2 credit + the run for the attempt log). */
export interface LineResult {
  credit: number;
  /** Every on-tree first answer accepted, no error anywhere. */
  firstTry: boolean;
  /** Every move played (learner and opponent), move keys: the attempt log's `path` (coverage). */
  path: string[];
  steps: LineStep[];
  /** An off-tree learner move could not be checked: the record is voided (no credit, no penalty). */
  voided: boolean;
  /** A partner move came from its safety net (03 §5.6). */
  safetyNet: boolean;
}

export interface LineViewProps extends Omit<ItemViewProps<LineExercise>, 'onFinished'> {
  onDone: (result: LineResult) => void;
  lineJudge: LineJudge;
  /** How often each continuation of a path was met before (from the local attempt log; `coverageCounts`). */
  coverage: (prefix: readonly string[]) => ReadonlyMap<string, number>;
}

type Phase = 'answering' | 'checking' | 'opponent' | 'dubious' | 'error' | 'illegal' | 'done';
type EndReason = 'leaf' | 'tree' | 'cap' | 'goal' | 'no-move' | 'mated';
interface Note {
  text: string;
  tone: 'good' | 'neutral' | 'info';
}

const HINT_ORDER: readonly HintStep[] = ['idea', 'piece', 'move'];

/**
 * A `line` (02-curriculum.md §5.1, 04-architecture.md §5.2): the learner plays down an authored tree. On the tree each
 * move is a lookup in the node's complete table and the opponent answers with an authored reply (coverage, then seed;
 * the main reply in tests). An accepted move without a continuation leaves the tree: the item ends (F1) or a training
 * partner takes over and the learner's moves get the default class from the analysis Worker (04 §5.4).
 */
export function LineView({ exercise: ex, onDone, onMistake, onAnswer, onHint, onOutOfLives, allowHints, test, judge, seed, lineJudge, coverage }: LineViewProps) {
  const { t, lang } = useI18n();
  const { play } = useSound();
  const [footerRef, footerHeight] = useElementHeight<HTMLElement>();
  const start = useMemo(() => positionOf(ex), [ex]);
  const side = ex.side ?? 'red';
  const guard = lineGuard(ex);

  const [moves, setMoves] = useState<Move[]>([]);
  const pos = useMemo(() => moves.reduce(makeMove, start), [moves, start]);
  /** The current learner node; null once the learner has left the tree. */
  const [node, setNode] = useState<LineLearnerNode | null>(ex.root);
  const [phase, setPhase] = useState<Phase>('answering');
  const [selected, setSelected] = useState<Square | null>(null);
  const [tried, setTried] = useState<Move | null>(null);
  const [entry, setEntry] = useState<MoveTableEntry | null>(null);
  const [illegal, setIllegal] = useState<MoveVerdict | null>(null);
  const [refutation, setRefutation] = useState<Refutation | 'pending' | null>(null);
  const [heartNote, setHeartNote] = useState<ReturnType<typeof onMistake>>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [end, setEnd] = useState<{ reason: EndReason; text?: string } | null>(null);
  const [hintStep, setHintStep] = useState(0);

  // Run facts for the credit and the attempt record (not rendered).
  const run = useRef({ firstClasses: [] as MoveClass[], nodeAnswered: false, errored: false, missed: false, steps: [] as LineStep[], offTree: 0, notChecked: 0, safetyNet: false });

  // Late async answers (refutation, classification, partner) are ignored after a retry or unmount.
  const generation = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      generation.current += 1;
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const offTree = node === null;
  const dubiousEnds = ex.dubious === 'accept' || test;
  const hintMove = node?.hints ? parseMoveKey(node.hints.move) : null;
  const hintsOn = allowHints && !test && node?.hints !== undefined;

  const finish = (reason: EndReason, text?: string) => {
    setEnd({ reason, text });
    setPhase('done');
    play(reason === 'mated' ? 'wrong' : 'correct', 0.12);
  };

  /** Records the first answer at the current on-tree node. */
  const noteFirst = (cls: MoveClass) => {
    const r = run.current;
    if (r.nodeAnswered) return;
    r.nodeAnswered = true;
    r.firstClasses.push(cls);
    if (!isAccepted(cls)) r.missed = true;
  };

  const showRefutation = (before: Position, move: Move) => {
    setRefutation('pending');
    const gen = ++generation.current;
    judge
      .refutation(before, move, guard)
      .then((r) => {
        if (gen !== generation.current) return;
        setRefutation(r.reply && r.kind ? r : null);
        if (r.reply) play(moveSound(makeMove(before, move), r.reply));
      })
      .catch(() => {
        if (gen === generation.current) setRefutation(null);
      });
  };

  const wrongMove = (move: Move, misconception?: string) => {
    run.current.errored = true;
    run.current.missed = true;
    play('wrong', 0.12);
    setTried(move);
    setHeartNote(onMistake(misconception));
    setPhase('error');
    showRefutation(pos, move);
  };

  // ----- The opponent -----

  const authoredReply = (after: Move[], opp: LineOpponentNode) => {
    setPhase('opponent');
    const gen = generation.current;
    timers.current.push(
      window.setTimeout(() => {
        if (gen !== generation.current) return;
        const reply = chooseReply(opp, { counts: coverage(pathKeys(after)), seed, ply: after.length, fixed: test });
        const m = keyToMove(reply.move);
        const before = after.reduce(makeMove, start);
        const next = [...after, m];
        play(moveSound(before, m));
        setMoves(next);
        setNotes(reply.text ? [{ text: t(reply.text), tone: 'info' }] : []);
        if (isLeaf(reply.next)) return finish('leaf', reply.next.text);
        run.current.nodeAnswered = false;
        setNode(reply.next);
        setHintStep(0);
        setPhase('answering');
      }, LINE_REPLY_MS),
    );
  };

  const partnerReply = (after: Move[]) => {
    const h = ex.handOver;
    if (!h) return finish('tree');
    setPhase('opponent');
    const gen = generation.current;
    void lineJudge.partnerMove({ start, moves: after, learner: side, partner: h.partner, seed: deriveSeed(seed, after.length) }).then((reply) => {
      if (gen !== generation.current) return;
      if (!reply) return finish('no-move');
      if (reply.safetyNet) run.current.safetyNet = true;
      const before = after.reduce(makeMove, start);
      const next = [...after, reply.move];
      play(moveSound(before, reply.move));
      setMoves(next);
      // The partner's move left the learner without a legal move: mated (or stalemated, also a loss).
      if (legalMoves(next.reduce(makeMove, start)).length === 0) return finish('mated');
      setPhase('answering');
    });
  };

  /** After an accepted learner move: continue on the tree, leave it, or end. */
  const continueAfter = (after: Move[], next: LineOpponentNode | LineLeaf | undefined) => {
    if (next === undefined) {
      setNode(null);
      return partnerReply(after);
    }
    if (isLeaf(next)) return finish('leaf', next.text);
    authoredReply(after, next);
  };

  /** Off the tree, after a learner move that stands: goal, cap, or the partner's turn. */
  const afterOffTreeMove = (after: Move[]) => {
    const h = ex.handOver!;
    const r = run.current;
    r.offTree += 1;
    if (legalMoves(after.reduce(makeMove, start)).length === 0) return finish('goal');
    const gen = generation.current;
    const goal = h.goal ? lineJudge.goal(h.goal, start, after, side) : Promise.resolve(false);
    void goal.then((met) => {
      if (gen !== generation.current) return;
      if (met) return finish('goal');
      if (r.offTree >= h.moves) return finish('cap');
      partnerReply(after);
    });
  };

  // ----- The learner -----

  const playMove = (move: Move) => {
    if (phase !== 'answering') return;
    setSelected(null);
    setNotes([]);
    const r = run.current;
    if (node) {
      const v = judgeLineMove(node, pos, move);
      if (v.kind === 'illegal') {
        noteFirst('error');
        r.errored = true;
        setIllegal(v.verdict);
        play('wrong');
        setHeartNote(onMistake());
        setPhase('illegal');
        return;
      }
      const row = v.entry;
      noteFirst(row.class);
      r.steps.push({ ply: moves.length, move: row.move, class: row.class, source: 'table' });
      if (row.class === 'error') return wrongMove(move, row.misconception);
      if (row.class === 'dubious' && !dubiousEnds) {
        onAnswer({ credit: 0, accepted: false, misconception: row.misconception });
        setEntry(row);
        setTried(move);
        play(moveSound(pos, move));
        setPhase('dubious');
        return;
      }
      const after = [...moves, move];
      play(moveSound(pos, move));
      play(row.class === 'dubious' ? 'move' : 'correct', 0.12);
      setMoves(after);
      setEntry(null);
      const lines: Note[] = [];
      if (row.class === 'dubious') lines.push({ text: t(row.reason ?? 'decision.dubious.body'), tone: 'neutral' });
      else if (row.reason) lines.push({ text: t(row.reason), tone: 'good' });
      setNotes(lines);
      return continueAfter(after, v.next);
    }

    // Off the tree: the default class, computed in the Worker (04 §5.4).
    const bad = legality(pos, move);
    if (bad) {
      r.errored = true;
      r.missed = true;
      setIllegal(bad);
      play('wrong');
      setHeartNote(onMistake());
      setPhase('illegal');
      return;
    }
    setPhase('checking');
    setTried(move);
    play(moveSound(pos, move));
    const gen = ++generation.current;
    void lineJudge.classify(pos, move, guard, ex.objective).then((cls: DefaultClass) => {
      if (gen !== generation.current) return;
      r.steps.push({ ply: moves.length, move: moveKey(move), class: cls, source: 'default' });
      if (cls === 'error') {
        setPhase('answering');
        return wrongMove(move);
      }
      setTried(null);
      const after = [...moves, move];
      setMoves(after);
      if (cls === 'not-checked') {
        r.notChecked += 1;
        setNotes([{ text: t('line.notChecked'), tone: 'neutral' }]);
      } else setNotes([{ text: t(cls === 'target' ? 'line.offTree.target' : 'line.offTree.dubious'), tone: cls === 'target' ? 'good' : 'neutral' }]);
      afterOffTreeMove(after);
    });
  };

  const retry = () => {
    generation.current += 1;
    setPhase('answering');
    setSelected(null);
    setTried(null);
    setEntry(null);
    setIllegal(null);
    setRefutation(null);
    setHeartNote(null);
  };

  const done = () => {
    const r = run.current;
    const credit = lineCredit(ex, r.firstClasses, r.errored);
    onDone({
      credit,
      firstTry: credit === 1 && !r.missed,
      path: pathKeys(moves),
      steps: r.steps,
      voided: r.notChecked > 0,
      safetyNet: r.safetyNet,
    });
  };

  const nextHint = () => {
    const step = HINT_ORDER[hintStep];
    if (!step) return;
    setHintStep(hintStep + 1);
    onHint(step);
  };

  const onSquareClick = (sq: Square) => {
    if (phase !== 'answering') return;
    const piece = pos.board[sq];
    if (piece && piece.color === pos.turn) {
      setSelected(sq === selected ? null : sq);
      return;
    }
    if (selected !== null) playMove({ from: selected, to: sq });
  };

  // ----- Board -----
  const afterTried = tried ? makeMove(pos, tried) : pos;
  const reply = refutation && refutation !== 'pending' ? refutation.reply : null;
  const shown = reply ? makeMove(afterTried, reply) : afterTried;
  const lastPlayed = moves.length > 0 ? moves[moves.length - 1] : null;
  const shownMove = reply ?? tried ?? lastPlayed;
  const before = reply ? afterTried : tried ? pos : moves.slice(0, -1).reduce(makeMove, start);
  const victim = shownMove ? before.board[shownMove.to] : null;
  const marks = new Map<Square, MarkTone>();
  if (phase === 'answering' && hintsOn && hintMove) {
    if (hintStep >= 2) marks.set(hintMove.from, 'hint');
    if (hintStep >= 3) marks.set(hintMove.to, 'target');
  }
  const dots = selected !== null && phase === 'answering' ? legalMoves(pos).filter((m) => m.from === selected).map((m) => m.to) : [];
  const checked = isInCheck(shown) ? findGeneral(shown.board, shown.turn) : null;
  const notation = (move: Move, p: Position) => formatMove(move, p, 'traditional', lang);

  // ----- Feedback -----
  const fb = ex.feedback;
  // The tempting alternative names a move of the root position (02 §7); only there does its text apply.
  const atRoot = moves.length === 0;
  let panel: { tone: 'correct' | 'incorrect' | 'neutral'; title: string; lines: { label?: string; text: string }[] } | null = null;
  if (phase === 'done' && end) {
    const lines: { label?: string; text: string }[] = [];
    if (end.text) lines.push({ text: t(end.text) });
    else if (end.reason !== 'leaf') lines.push({ text: t(`line.end.${end.reason}`) });
    if (fb && end.reason !== 'mated') lines.push({ label: t('feedback.label.purpose'), text: t(fb.purpose) }, { label: t('feedback.label.keyReply'), text: t(fb.keyReply) });
    if (ex.explanation) lines.push({ text: t(ex.explanation) });
    panel = { tone: end.reason === 'mated' ? 'neutral' : 'correct', title: t(end.reason === 'mated' ? 'line.mated' : 'line.done'), lines };
  } else if (phase === 'dubious' && entry) {
    const lines: { label?: string; text: string }[] = [{ text: t(entry.reason ?? 'decision.dubious.body') }];
    if (atRoot && fb && fb.temptingAlternative.move === entry.move) lines.push({ label: t('feedback.label.tempting'), text: t(fb.temptingAlternative.text) });
    if (hintsOn && node?.hints) lines.push({ label: t('feedback.label.idea'), text: t(node.hints.idea) });
    lines.push({ text: t('decision.dubious.retry') });
    panel = { tone: 'neutral', title: t('decision.title.dubious'), lines };
  } else if (phase === 'error' && tried) {
    const lines: { label?: string; text: string }[] = [];
    const row = node?.table.find((e) => e.move === moveKey(tried));
    if (refutation === 'pending') lines.push({ text: t('decision.refuting') });
    else if (refutation?.reply && refutation.kind) {
      lines.push({ text: t(refutation.kind === 'mate' ? 'decision.refute.mate' : 'decision.refute.material', { move: notation(refutation.reply, afterTried) }) });
    } else if (!row?.reason) lines.push({ text: t('decision.error.generic') });
    if (row?.reason) lines.push({ text: t(row.reason) });
    if (atRoot && fb && fb.temptingAlternative.move === moveKey(tried)) lines.push({ label: t('feedback.label.tempting'), text: t(fb.temptingAlternative.text) });
    else if (atRoot && fb) lines.push({ text: t(fb.commonError) });
    panel = { tone: 'incorrect', title: t('feedback.incorrect'), lines };
  } else if (phase === 'illegal' && illegal) {
    panel = { tone: 'incorrect', title: t('feedback.incorrect'), lines: [{ text: t(`verdict.${illegal}`) }] };
  }

  const status =
    phase === 'opponent'
      ? t(offTree ? 'line.partnerThinking' : 'combination.opponent.neutral')
      : phase === 'checking'
        ? t('combination.checking')
        : phase === 'done'
          ? t('line.done')
          : offTree
            ? t('line.offTree', { n: Math.max(0, (ex.handOver?.moves ?? 0) - run.current.offTree) })
            : t('side.toMove', { side: t(`color.${side}`) });

  return (
    <>
      <section className="flex-1 px-4 pb-4" style={{ '--footer-h': `${footerHeight}px` } as CSSProperties}>
        <p className="text-sm font-bold tracking-wide text-violet-600 uppercase">{t('lesson.type.line')}</p>
        <h2 className="mt-1 mb-1 text-lg leading-snug font-bold text-stone-800" data-testid="prompt">
          {t(ex.prompt)}
        </h2>
        <p className="mb-1 text-sm font-semibold text-stone-500" data-testid="line-status">
          {status}
        </p>
        {offTree && ex.handOver && phase !== 'done' && (
          <p className="mb-1 text-sm text-stone-600" data-testid="line-partner">
            {t('line.partner')}
          </p>
        )}
        <div className="mb-2 min-h-5" aria-live="polite" data-testid="line-notes">
          {phase !== 'done' &&
            notes.map((n, i) => (
              <p key={i} className={`text-sm font-semibold ${n.tone === 'good' ? 'text-green-700' : n.tone === 'neutral' ? 'text-amber-800' : 'text-violet-700'}`}>
                {n.text}
              </p>
            ))}
        </div>
        <div className={`board-fit overflow-hidden rounded-xl shadow-md ${phase === 'error' || phase === 'illegal' ? 'feedback-shake' : ''}`}>
          <Board
            position={shown}
            selected={selected}
            dots={dots}
            marks={marks}
            lastMove={shownMove}
            animateMove={shownMove}
            captured={shownMove && victim ? { at: shownMove.to, piece: victim as Piece } : null}
            checkedGeneral={checked}
            onSquareClick={onSquareClick}
            orientation={side}
            fileNumbers
          />
        </div>
        {phase === 'answering' && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-stone-500">{t('lesson.tapPiece')}</p>
            {hintsOn && hintStep > 0 && (
              <p className="text-center text-sm font-semibold text-violet-700" data-testid="hint-text">
                {hintStep === 1
                  ? t(node!.hints!.idea)
                  : hintStep === 2
                    ? t('combination.hintPiece')
                    : t('decision.hint.move', { move: hintMove ? notation(hintMove, pos) : '' })}
              </p>
            )}
            {hintsOn && hintStep < HINT_ORDER.length && (
              <button type="button" onClick={nextHint} className="min-h-11 rounded-xl px-4 text-sm font-bold text-violet-700 underline">
                {t(`decision.hint.next.${HINT_ORDER[hintStep]}`)}
              </button>
            )}
            <MovePicker key={moves.length} position={pos} onMove={playMove} />
          </div>
        )}
      </section>
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />

      {panel && (
        <FeedbackPanel
          key={phase}
          panelRef={footerRef}
          tone={panel.tone}
          title={panel.title}
          heartNote={phase === 'error' || phase === 'illegal' ? heartNote : null}
          actions={
            phase === 'done' ? (
              <PrimaryButton onClick={done}>{t('lesson.continue')}</PrimaryButton>
            ) : phase === 'dubious' ? (
              <PrimaryButton onClick={retry}>{t('lesson.retry')}</PrimaryButton>
            ) : (
              <PrimaryButton tone="red" onClick={onOutOfLives ?? retry}>
                {t(onOutOfLives ? 'jump.seeResult' : 'lesson.retry')}
              </PrimaryButton>
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
