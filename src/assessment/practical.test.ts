import { describe, expect, it } from 'vitest';
import type { AnalysisOutcome, AnalysisRequest } from '../analysis/requests';
import type { PlayExercise } from '../content/types';
import { legalMoves, parseFen, positionFromPieces, START_FEN } from '../engine';
import { parseMoveKey } from '../lessons/decision';
import { DISCLOSURE_KEYS, appendMove, createRecord, currentPosition, directAnalyzer, type Analyzer } from '../play';
import { OPENING_OBJECTIVE, convertFixture, drillFixture, gameFixture, holdFixture, openingFixture } from './play-fixtures';
import { executeRequest } from '../analysis/requests';
import { resolveGuard } from '../lessons/guard';
import {
  EXAM_SLOTS_UNDER_F,
  PARTNER_REGIME,
  applicationGrant,
  developmentFacts,
  disclosureKeys,
  fallbackOf,
  offTreeSelective,
  learnerTurn,
  levelReachable,
  parseTaskState,
  partnerPlan,
  referenceLearner,
  safeShuffler,
  randomLearner,
  simulateTask,
  startTask,
  type Level,
  type PoolTask,
} from './practical';

const deps = { analyzer: directAnalyzer() };

/** The direct analyzer with some requests answered 'not-checked'. */
function failing(fail: (r: AnalysisRequest) => 'timeout' | 'node-limit' | null): Analyzer {
  const real = directAnalyzer();
  return {
    run<R extends AnalysisRequest>(request: R): Promise<AnalysisOutcome<R['kind']>> {
      const reason = fail(request);
      if (reason) return Promise.resolve({ status: 'not-checked', kind: request.kind, reason, nodes: 0 } as AnalysisOutcome<R['kind']>);
      return real.run(request);
    },
  };
}

describe('partner regimes and chains (03 §5.2)', () => {
  it('the default regime is fallback until pressing is validated (S2.18)', () => expect(PARTNER_REGIME).toBe('fallback'));

  it.each([
    ['drill', null, null, ['safe-sparring']],
    ['opening', 'F5', null, ['safe-sparring']],
    ['plan', 'F1', null, ['forcing-attack']],
    ['hold', 'F1', null, ['forcing-attack']],
    ['convert', 'F1c', null, ['forcing-attack', 'best-defence']],
    ['game', 'F2', null, ['safe-sparring']],
  ] as const)('%s: fallback %s', (task, fb, _main, links) => {
    const ex = { task, id: 'i05l1-01' } as Pick<PlayExercise, 'task' | 'id'>;
    expect(fallbackOf(ex, 'fallback')).toBe(fb);
    expect(fallbackOf(ex, 'main')).toBeNull();
    expect(partnerPlan(ex, 'fallback').links.map((l) => l.kind)).toEqual(links);
  });

  it('main regime: pressing(2) ends the hold / convert / opening / game chains; F1 ends the task on hand-over', () => {
    for (const task of ['plan', 'hold', 'convert', 'opening', 'game'] as const) {
      expect(partnerPlan({ task }, 'main').links.at(-1)).toEqual({ kind: 'pressing', d: 2 });
      expect(partnerPlan({ task }, 'main').endOnHandOver).toBe(false);
    }
    expect(partnerPlan({ task: 'hold' }, 'fallback').endOnHandOver).toBe(true);
  });

  it('F1c: resist mode at k = d = 2 unless measured (then 3); F2b keeps the tree; τ = 1.0 at Basic, 0.5 above', () => {
    expect(partnerPlan({ task: 'convert' }, 'fallback').links[1]).toEqual({ kind: 'best-defence', resist: true, k: 2, d: 2 });
    expect(partnerPlan({ task: 'convert', measured: true }, 'fallback').links[1]).toMatchObject({ k: 3, d: 3 });
    expect(fallbackOf({ task: 'game', f2b: true }, 'fallback')).toBe('F2b');
    expect(partnerPlan({ task: 'game', f2b: true, tree: holdFixture().tree }, 'fallback').tree).toBe(true);
    expect(partnerPlan({ task: 'game' }, 'fallback').links[0]).toEqual({ kind: 'safe-sparring', d: 2, tau: 1.0 });
    expect(partnerPlan({ task: 'opening', id: 'b09-g1' }, 'fallback').links[0]).toMatchObject({ tau: 1.0 });
    expect(partnerPlan({ task: 'opening', id: 'i08-g1' }, 'fallback').links[0]).toMatchObject({ tau: 0.5 });
  });

  it('disclosure: the general sentence, then the tree and every link (03 §5.2 text)', () => {
    expect(disclosureKeys(openingFixture(), 'fallback')).toEqual([DISCLOSURE_KEYS.general, DISCLOSURE_KEYS.scripted, DISCLOSURE_KEYS['safe-sparring']]);
    expect(disclosureKeys(convertFixture(), 'fallback')).toEqual([DISCLOSURE_KEYS.general, DISCLOSURE_KEYS['forcing-attack'], DISCLOSURE_KEYS['best-defence-resist']]);
    expect(disclosureKeys(holdFixture(), 'main')).toEqual([DISCLOSURE_KEYS.general, DISCLOSURE_KEYS.scripted, DISCLOSURE_KEYS['forcing-attack'], DISCLOSURE_KEYS.pressing]);
  });
});

describe('F3 / F4 and the reachability table on a fixture pool (03 §5.2)', () => {
  const pool: PoolTask[] = [];
  let n = 0;
  const add = (level: Level, kind: PoolTask['kind'], side: 'red' | 'black' = 'red', ok = true) => pool.push({ id: `t${n++}`, level, kind, side, passesGuardUnderF: ok });
  add('basics', 'game');
  add('basics', 'game', 'black');
  add('basics', 'hold');
  add('basics', 'hold', 'black');
  add('basics', 'review');
  add('intermediate', 'opening');
  add('intermediate', 'opening', 'black');
  add('intermediate', 'convert');
  add('advanced', 'plan');
  add('advanced', 'hold', 'black');
  add('advanced', 'convert');
  add('advanced', 'review');
  add('expert', 'opening');
  add('expert', 'opening', 'black');
  add('expert', 'convert');
  add('expert', 'hold');
  add('expert', 'review');
  add('master', 'opening');
  add('master', 'plan', 'black');
  add('master', 'hold');
  add('master', 'convert', 'black');
  add('master', 'review');

  it('every level is applied-reachable under F', () => {
    for (const level of Object.keys(EXAM_SLOTS_UNDER_F) as Level[]) expect(levelReachable(level, pool)).toEqual({ reachable: true, missing: [] });
  });

  it('a missing slot, a task failing its §5.7 guard or one colour only makes the level unreachable', () => {
    expect(levelReachable('intermediate', pool.filter((t) => !(t.level === 'intermediate' && t.kind === 'convert'))).missing).toEqual(['xi-F1c-convert']);
    expect(levelReachable('intermediate', pool.map((t) => (t.level === 'intermediate' && t.side === 'black' ? { ...t, passesGuardUnderF: false } : t))).missing).toEqual(['xi-F5-opening']);
    expect(levelReachable('master', pool.map((t) => ({ ...t, side: 'red' as const }))).missing).toEqual(['xm-both-colours']);
    expect(levelReachable('basics', pool.filter((t) => t.kind !== 'hold' || t.level !== 'basics')).missing).toEqual(['xb-F3-hold']);
  });
});

describe('fixed recorded games (03 §10)', () => {
  it('HOLD (F1): the defence Rxc6 reaches the scoring leaf and passes; the grant records F1', async () => {
    const ex = holdFixture();
    const run = await simulateTask(ex, 'fallback', 1, referenceLearner(['c5-c6']), deps);
    expect(run.result.end).toEqual({ reason: 'leaf' });
    expect(run.result.score).toMatchObject({ pass: true, voided: false, score: 100 });
    expect(run.result.score.values).toMatchObject({ R5: 100, R1: 100 });
    expect(applicationGrant(ex, run.result, '2026-10-30T00:00:00.000Z')).toEqual({ at: '2026-10-30T00:00:00.000Z', via: 'practical', score: 100, taskVersion: 1, fallback: 'F1' });
  });

  it('HOLD (F1): a quiet move off the tree ends the task when forcing-attack hands over (tree-end)', async () => {
    const run = await simulateTask(holdFixture(), 'fallback', 1, referenceLearner(['c5-c4']), deps);
    expect(run.result.end).toEqual({ reason: 'tree-end' });
    expect(run.state.record.moves).toHaveLength(1);
  });

  it('HOLD: leaving the Chariot en prise costs R1 50, R0 and the pass (forcing-attack takes it)', async () => {
    const ex = holdFixture();
    const run = await simulateTask(ex, 'fallback', 1, referenceLearner(['d0-e1']), deps);
    expect(run.state.record.moves[1].partner?.policy).toBe('forcing-attack(2)');
    expect(run.state.record.moves[1].capture).toBe(true);
    expect(run.result.score.values.R1).toBeLessThanOrEqual(50);
    expect(run.result.score.values.R0).toBe(0);
    expect(run.result.score.pass).toBe(false);
    expect(applicationGrant(ex, run.result, '2026-10-30T00:00:00.000Z')).toBeNull();
  });

  it('CONVERT (F1c): the reference mates against resist mode; R4 = 100', async () => {
    const run = await simulateTask(convertFixture(), 'fallback', 3, referenceLearner(), deps);
    expect(run.result.end.outcome?.reason).toBe('checkmate');
    expect(run.state.record.moves.some((m) => m.partner?.policy.startsWith('best-defence-resist(2,2)'))).toBe(true);
    expect(run.result.score).toMatchObject({ pass: true });
    expect(run.result.score.values.R4).toBe(100);
  });

  it('OPENING (F5): the tree line gives 6 counted, credited moves; N1 fails the gate', async () => {
    const ex = openingFixture();
    const ref = await simulateTask(ex, 'fallback', 1, referenceLearner(ex.reference![0]), deps);
    expect(ref.result.share).toMatchObject({ counted: 6, credited: 6, gate: true });
    expect(ref.result.score.pass).toBe(true);
    // Six learner nodes, five authored replies (the last node ends in a leaf).
    expect(ref.state.record.moves.filter((m) => m.partner?.policy === 'scripted')).toHaveLength(5);
    const n1 = await simulateTask(ex, 'fallback', 2, randomLearner, deps);
    expect(n1.result.score.pass).toBe(false);
  }, 60_000);

  it('a seeded N2 simulation on the opening fixture tree fails ≥ 80 % of the assessed runs', async () => {
    const ex = openingFixture();
    let assessed = 0;
    let failed = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const r = await simulateTask(ex, 'fallback', seed, safeShuffler, deps);
      if (r.result.score.voided) continue;
      assessed++;
      if (!r.result.score.pass) failed++;
    }
    expect(assessed).toBeGreaterThan(0);
    expect(failed / assessed).toBeGreaterThanOrEqual(0.8);
  }, 120_000);
});

describe('voided runs (03 §5.6)', () => {
  it('a learner move whose signals are not checked voids the run (no grant)', async () => {
    const ex = holdFixture();
    const run = await simulateTask(ex, 'fallback', 1, referenceLearner(['c5-c6']), { analyzer: failing((r) => (r.kind === 'move-signals' ? 'timeout' : null)) });
    expect(run.result.score).toMatchObject({ voided: true, pass: false });
    expect(run.result.score.voids).toContain('signal-not-checked');
    expect(applicationGrant(ex, run.result, '2026-10-30T00:00:00.000Z')).toBeNull();
  });

  it('a partner safety-net move voids the run', async () => {
    const ex = drillFixture();
    const slow = failing((r) => (r.kind === 'score-moves' && r.depth === 2 ? 'timeout' : null));
    const longer = await simulateTask({ ...ex, cap: 2 }, 'fallback', 1, referenceLearner(['h0-g2', 'b0-c2']), { analyzer: slow });
    expect(longer.state.record.moves[1].partner?.safetyNet).toBe('timeout');
    expect(longer.result.score.voids).toContain('partner-safety-net');
  });
});

describe('task state (persisted mid-game)', () => {
  it('survives a JSON round trip and resumes; other versions, regimes or illegal records are refused', async () => {
    const ex = openingFixture();
    let s = startTask(ex, 'fallback', 7);
    s = await learnerTurn(ex, s, parseMoveKey('h0-g2')!, deps);
    const stored = JSON.parse(JSON.stringify(s));
    const back = parseTaskState(stored, ex, 'fallback');
    expect(back).toEqual(s);
    expect(parseTaskState(stored, ex, 'main')).toBeNull();
    expect(parseTaskState(stored, { ...ex, version: 2 }, 'fallback')).toBeNull();
    expect(parseTaskState({ ...stored, record: { ...stored.record, moves: [{ move: { from: 0, to: 80 } }] } }, ex, 'fallback')).toBeNull();
    expect(parseTaskState('junk', ex, 'fallback')).toBeNull();
    await expect(learnerTurn(ex, s, parseMoveKey('h9-g7')!, deps)).rejects.toThrow(/not the learner/);
  });
});

describe('R2 facts from the record', () => {
  it('counts development by move n, idle General/Advisor moves and pieces moved more than 3 times', () => {
    let r = createRecord(parseFen(START_FEN), { learner: 'red', seed: 1 });
    const play = (...ks: string[]) => ks.forEach((k) => (r = appendMove(r, parseMoveKey(k)!)));
    play('h0-g2', 'h9-g7', 'd0-e1', 'b9-c7', 'i0-i1', 'a9-b9', 'i1-i2', 'i9-h9', 'i2-i1', 'b7-b3', 'i1-i2');
    expect(developmentFacts(r, 6, 3)).toEqual({ developed: 2, target: 3, idleDefenderMoves: 1, overmoved: true });
    expect(developmentFacts(r, 2, 3).overmoved).toBe(false);
  });
});

describe('full games under F2', () => {
  it('a game task is played under the full-game rules with safe-sparring(2, 1.0), scored R1 60 + R2 20 + R0 20', () => {
    const g = gameFixture();
    expect(partnerPlan(g, 'fallback').links).toEqual([{ kind: 'safe-sparring', d: 2, tau: 1.0 }]);
    expect(startTask(g, 'fallback', 1).fallback).toBe('F2');
  });
});

describe('line share on real positions (03 §5.3 rule 3; AC 4)', () => {
  /** An F5-scored task around a position: R6 + R1, the opening objective, L = 6, no tree. */
  const shareTask = (pieces: Record<string, string>, turn: 'red' | 'black' = 'red'): PlayExercise => ({
    type: 'play',
    id: 'b10l9-09',
    version: 1,
    side: turn,
    pieces,
    turn,
    prompt: 'u3l1.e1',
    task: 'opening',
    cap: 8,
    rubrics: [
      { rubric: 'R6', weight: 60 },
      { rubric: 'R1', weight: 40 },
    ],
    objective: OPENING_OBJECTIVE,
    development: { n: 6, target: 4 },
    lineShare: 6,
  });
  const guard = resolveGuard({ itemId: 'b10l9-09' });

  /** The rule computed directly: credited (guard + objective) ÷ guard-passing in (0, 1/3]. */
  function ruleFraction(pos: ReturnType<typeof positionFromPieces>) {
    let passing = 0;
    let credited = 0;
    for (const move of legalMoves(pos)) {
      const g = executeRequest({ kind: 'safety-guard', position: pos, move, guard });
      if (g.status !== 'checked' || !g.value.safe) continue;
      passing++;
      const o = executeRequest({ kind: 'predicate', predicate: OPENING_OBJECTIVE, before: pos, moves: [move], side: pos.turn });
      if (o.status === 'checked' && o.value) credited++;
    }
    return { passing, credited, counted: credited > 0 && credited * 3 <= passing };
  }

  // Nuance (03 §5.3 rule 3): a check evasion is not counted only when NO evasion is creditable. When a developing move
  // also answers the check, the position is counted exactly when the credited fraction of the guard-passing evasions
  // is ≤ 1/3 — with few safe evasions one developing evasion is often above 1/3, so even then it may not count.
  it('a check evasion with no developing answer is played but not counted', async () => {
    // The Black chariot e5 checks along the e-file; only General moves answer it, the b0 Horse cannot block.
    const ex = shareTask({ e0: 'K', b0: 'N', e9: 'k', e5: 'r' });
    const s0 = startTask(ex, 'fallback', 1);
    const pos = positionFromPieces({ e0: 'K', b0: 'N', e9: 'k', e5: 'r' }, 'red');
    expect(ruleFraction(pos)).toMatchObject({ credited: 0, counted: false });
    expect(await offTreeSelective(deps, pos, guard, OPENING_OBJECTIVE)).toBe(false);
    const s1 = await learnerTurn(ex, s0, legalMoves(pos).find((m) => pos.board[m.from]?.type === 'general')!, deps);
    expect(s1.facts[0].share).toEqual({ counted: false, credited: false });
  });

  it('a check evasion that develops counts per the rule-3 fraction', async () => {
    // The a2 chariot checks along rank 2; Hb0-c2 blocks (develops), Hb0xa2 takes it (develops), Kf2-f1 steps away.
    const pieces = { f2: 'K', b0: 'N', h0: 'N', e9: 'k', a2: 'r', i9: 'r' };
    const pos = positionFromPieces(pieces, 'red');
    const rule = ruleFraction(pos);
    expect(rule.credited).toBeGreaterThan(0);
    expect(await offTreeSelective(deps, pos, guard, OPENING_OBJECTIVE)).toBe(rule.counted);
    const ex = shareTask(pieces);
    const s1 = await learnerTurn(ex, startTask(ex, 'fallback', 1), parseMoveKey('b0-a2')!, deps);
    expect(s1.facts[0].share).toEqual({ counted: rule.counted, credited: true });
  });

  it('a learner who completes development early still passes the gate; the run is not voided', async () => {
    const ex = openingFixture();
    const run = await simulateTask(ex, 'fallback', 1, referenceLearner(ex.reference![0]), deps);
    // Horses and chariots are all out after the learner's 4th move …
    expect(developmentFacts(run.state.record, 4, 4).developed).toBe(4);
    // … the last two moves (off the tree, nothing left to develop) are played but not counted.
    expect(run.state.facts.slice(6).map((f) => f.share?.counted)).toEqual([false, false]);
    expect(run.result.share).toMatchObject({ counted: 6, gate: true, voided: false });
    expect(run.result.score).toMatchObject({ pass: true, voided: false });
  }, 60_000);

  it('an off-tree F5 run whose facts cannot be checked is voided (fact-not-checked), with no grant', async () => {
    const ex = openingFixture();
    const broken = failing((r) => (r.kind === 'predicate' ? 'node-limit' : null));
    // e3-e4 is a table row without a continuation: the learner leaves the tree, so the next move is classed off it.
    const run = await simulateTask(ex, 'fallback', 1, referenceLearner(['e3-e4']), { analyzer: broken });
    expect(run.state.facts[0].source).toBe('table');
    expect(run.state.facts[1]).toMatchObject({ source: 'default', class: 'not-checked', share: { counted: null } });
    expect(run.result.score).toMatchObject({ voided: true, pass: false });
    expect(run.result.score.voids).toContain('fact-not-checked');
    expect(applicationGrant(ex, run.result, '2026-10-30T00:00:00.000Z')).toBeNull();
  }, 60_000);
});

describe('naive learners face the learner refusal rule', () => {
  it('N1 and N2 may claim a repetition that is the opponent’s perpetual check', async () => {
    const ex: PlayExercise = {
      type: 'play',
      id: 'b10l9-08',
      version: 1,
      side: 'black',
      pieces: { d0: 'K', h8: 'R', e9: 'k' },
      turn: 'red',
      prompt: 'u3l1.e1',
      task: 'drill',
      cap: 10,
      rubrics: [
        { rubric: 'R1', weight: 50 },
        { rubric: 'R0', weight: 50 },
      ],
    };
    let state = startTask(ex, 'fallback', 1);
    for (const k of ['h8-h9', 'e9-e8', 'h9-h8', 'e8-e9', 'h8-h9', 'e9-e8', 'h9-h8']) state = { ...state, record: appendMove(state.record, parseMoveKey(k)!) };
    const position = currentPosition(state.record);
    const picks = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      for (const learner of [randomLearner, safeShuffler]) {
        const m = await learner({ ex, state, position, learnerIndex: 3, deps, seed });
        if (m) picks.add(`${m.from}-${m.to}`);
      }
    }
    const claim = parseMoveKey('e8-e9')!;
    expect(picks.has(`${claim.from}-${claim.to}`)).toBe(true);
  });
});
