// Answer key of the S2.19 walkthrough (scripts/ui-walkthrough/walkthrough.ts; test-only, never part of the app).
//
// The walkthrough sees the app only as a user does: the board (each point's accessible name, e.g. "e0, Red General")
// and the texts on screen. This module turns the course content into what the walkthrough needs to recognise the item
// on screen and to answer it right or wrong:
// - every item of the preview path, the served pools and the J1 fixture is indexed by its start board (pieces only)
//   and its prompt text (English);
// - right / wrong answers come from the content itself (accepted vs error rows of complete move tables, correct vs
//   wrong choice options, the engine-computed expected selection, the verified `solution` of a move item);
// - `line` items are followed node by node (the board after each reply identifies the learner node);
// - practical tasks are played by the §5.7 reference player (`referenceLearner` of src/assessment/practical.ts) from
//   the game state the app saves after every move (`duohuygo:play.inProgress.v1`).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { choiceItem } from '../../src/assessment/test-fixtures';
import { holdFixture } from '../../src/assessment/play-fixtures';
import { learnerMoveCount, parseTaskState, referenceLearner, type TaskState } from '../../src/assessment/practical';
import { PARTNER_REGIME } from '../../src/assessment/regime';
import { coursePath, CURRENT_RELEASE, orderUnits, RELEASE_STATES } from '../../src/content/release';
import type {
  AssessmentItem,
  AssessmentPool,
  ChoiceExercise,
  DecisionExercise,
  Exercise,
  LineExercise,
  LineLearnerNode,
  LineNode,
  MoveExercise,
  PlayExercise,
  SelectSquaresExercise,
  Strand,
  Unit,
} from '../../src/content/types';
import { makeMove, squareName, type Position } from '../../src/engine';
import { translate } from '../../src/i18n/messages';
import { expectedSelection, positionOf } from '../../src/lessons/answers';
import { isAccepted, moveKey, parseMoveKey } from '../../src/lessons/decision';
import { formatMove } from '../../src/notation/format';
import { currentPosition, directAnalyzer } from '../../src/play';

const root = resolve(import.meta.dirname, '../..');
const readJson = <T>(dir: string): Record<string, T> =>
  Object.fromEntries(
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => [`./${dir}/${f}`, JSON.parse(readFileSync(join(root, dir, f), 'utf8')) as T]),
  );

export const en = (key: string, vars?: Record<string, string | number>): string => translate('en', key, vars);

/** The units the course preview shows (src/content/index.ts `units` with VITE_COURSE_PREVIEW=1). */
export const previewUnits: Unit[] = coursePath(orderUnits(readJson<Unit>('src/content/lessons')), { preview: true, state: RELEASE_STATES[CURRENT_RELEASE] });
/** Every pool file (the app serves the reviewed items in the preview). */
export const pools: AssessmentPool[] = Object.values(readJson<AssessmentPool>('src/content/assessment'));

/** The J1 fixture items of scripts/ui-fixtures/preview-fixture.tsx `?pools=j1` (built the same way; kept in sync by hand). */
export function j1FixtureItems(): AssessmentItem[] {
  const strands: readonly Strand[] = ['RS', 'TC', 'OD', 'PA', 'DE'];
  const items = Array.from({ length: 20 }, (_, i) =>
    choiceItem({
      id: `pb-${String(i + 1).padStart(2, '0')}`,
      unit: 'b09',
      objective: 'b09l3',
      strand: strands[i % 5],
      side: i % 5 === 1 || i % 5 === 3 ? 'black' : 'red',
      nature: i % 4 === 0 ? 'quiet' : 'tactic',
      critical: i % 5 === 0 && i < 10,
      status: 'reviewed',
      point: i,
    }),
  );
  const practical = { ...holdFixture(), id: 'pb-g1', status: 'reviewed', unit: 'b09', objective: 'b09l3', equivalentOf: 'b09-g1' } as unknown as AssessmentItem;
  return [...items, practical];
}

// ---------- Boards ----------

const LETTER: Record<string, string> = { general: 'k', advisor: 'a', elephant: 'b', horse: 'n', chariot: 'r', cannon: 'c', soldier: 'p' };
const TYPE_OF_NAME: Record<string, string> = Object.fromEntries(Object.keys(LETTER).map((type) => [en(`piece.${type}`), type]));

/** Pieces only (no side to move): "a0R b0N …", sorted. */
export function boardKey(pos: Position): string {
  const parts: string[] = [];
  pos.board.forEach((p, sq) => {
    if (!p) return;
    const l = LETTER[p.type];
    parts.push(`${squareName(sq)}${p.color === 'red' ? l.toUpperCase() : l}`);
  });
  return parts.sort().join(' ');
}

/** The same key from the board's accessible point names ("e0, Red General, legal move"). */
export function boardKeyFromLabels(labels: readonly string[]): string {
  const parts: string[] = [];
  for (const label of labels) {
    const [sq, desc] = label.split(', ');
    if (!desc) continue;
    const [color, name] = desc.split(' ');
    const type = TYPE_OF_NAME[name];
    if (!type || (color !== en('color.red') && color !== en('color.black'))) continue;
    const l = LETTER[type];
    parts.push(`${sq}${color === en('color.red') ? l.toUpperCase() : l}`);
  }
  return parts.sort().join(' ');
}

// ---------- Items ----------

export interface KeyedItem {
  ex: Exercise;
  /** Where it comes from: `b09l3`, `a03-check`, `pa`, `j1-fixture`. */
  where: string;
  board: string;
  prompt: string;
}

const promptOf = (ex: Exercise): string => en(ex.type === 'learn' ? ex.text : ex.prompt);

export function keyed(ex: Exercise, where: string): KeyedItem {
  return { ex, where, board: boardKey(positionOf(ex)), prompt: promptOf(ex) };
}

export const lessonItems = (lessonId: string): KeyedItem[] => {
  const lesson = previewUnits.flatMap((u) => u.lessons).find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`lesson ${lessonId} is not in the preview path`);
  return lesson.exercises.map((ex) => keyed(ex, lessonId));
};
export const poolItems = (poolId: string): KeyedItem[] => {
  const pool = pools.find((p) => p.id === poolId);
  if (!pool) throw new Error(`pool ${poolId} not found`);
  return pool.items.map((ex) => keyed(ex, poolId));
};
export const allPreviewItems = (): KeyedItem[] => [
  ...previewUnits.flatMap((u) => u.lessons.flatMap((l) => l.exercises.map((ex) => keyed(ex, l.id)))),
  ...pools.flatMap((p) => p.items.map((ex) => keyed(ex, p.id))),
];

/** The candidates showing this board and prompt (normally exactly one). */
export const matchItem = (candidates: readonly KeyedItem[], board: string, prompt: string): KeyedItem[] =>
  candidates.filter((c) => c.board === board && c.prompt === prompt.trim());

// ---------- Answers ----------

export type Mode = 'right' | 'wrong';

export function decisionMove(ex: Pick<DecisionExercise, 'table'>, mode: Mode): string {
  const rows = ex.table;
  if (mode === 'right') return (rows.find((r) => r.class === 'target') ?? rows.find((r) => isAccepted(r.class)))!.move;
  return (rows.find((r) => r.class === 'error') ?? rows.find((r) => r.class === 'dubious'))!.move;
}

export function selection(ex: SelectSquaresExercise, mode: Mode): string[] {
  const expected = expectedSelection(ex);
  if (mode === 'right') return expected.map(squareName);
  const own = ex.square;
  for (let sq = 0; sq < 90; sq++) {
    const name = squareName(sq);
    if (!expected.includes(sq) && name !== own) return [name];
  }
  throw new Error('no wrong square');
}

/** English labels of the options to pick (as ChoiceView shows them: notation — text). */
export function choiceLabels(ex: ChoiceExercise, mode: Mode): string[] {
  const start = positionOf(ex);
  const label = (o: ChoiceExercise['options'][number]) => {
    const m = o.move ? parseMoveKey(o.move) : null;
    return [m ? formatMove(m, start, 'traditional', 'en') : null, o.text ? en(o.text) : null].filter(Boolean).join(' — ');
  };
  if (mode === 'right') return ex.options.filter((o) => o.correct).map(label);
  return [label(ex.options.find((o) => !o.correct)!)];
}

export function moveAnswer(ex: MoveExercise, mode: Mode): string {
  if (mode === 'wrong' && ex.feedback) return ex.feedback.temptingAlternative.move;
  const s = ex.solution as unknown;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object' && 'from' in s && 'to' in s) return `${(s as { from: string }).from}-${(s as { to: string }).to}`;
  throw new Error(`move item ${ex.id} has no solution`);
}

// ---------- Lines ----------

/** Learner nodes of a line tree by the board they are played from. */
export function lineNodes(ex: LineExercise): Map<string, LineLearnerNode> {
  const out = new Map<string, LineLearnerNode>();
  const walk = (node: LineNode | undefined, pos: Position) => {
    if (!node || node.kind === 'leaf') return;
    if (node.kind === 'learner') {
      out.set(boardKey(pos), node);
      for (const [key, next] of Object.entries(node.next ?? {})) walk(next, makeMove(pos, parseMoveKey(key)!));
    } else for (const r of node.replies) walk(r.next, makeMove(pos, parseMoveKey(r.move)!));
  };
  walk(ex.root, positionOf(ex));
  return out;
}

/** The move to play at a learner node: an accepted move that continues (target first), or an error row. */
export function lineMove(node: LineLearnerNode, mode: Mode): string {
  if (mode === 'wrong') return decisionMove(node, 'wrong');
  const continues = (m: string) => node.next?.[m] !== undefined;
  const accepted = node.table.filter((r) => isAccepted(r.class));
  return (accepted.find((r) => r.class === 'target' && continues(r.move)) ?? accepted.find((r) => continues(r.move)) ?? accepted[0]).move;
}

// ---------- Practical tasks ----------

const analyzer = directAnalyzer();

/**
 * The reference player's next move in the saved game (`stored` = the task's entry of play.inProgress.v1), or null
 * when the state cannot be read.
 */
export async function referenceMove(ex: PlayExercise, stored: unknown): Promise<string | null> {
  const state: TaskState | null = parseTaskState(stored, ex, PARTNER_REGIME);
  if (!state) return null;
  const learner = referenceLearner(ex.reference?.[0] ?? []);
  const position = currentPosition(state.record);
  const move = await learner({ ex, state, position, learnerIndex: learnerMoveCount(state.record), deps: { analyzer }, seed: state.seed });
  return move ? moveKey(move) : null;
}
