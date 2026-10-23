import { describe, expect, it } from 'vitest';
import { positionFromPieces, toFen } from '../engine';
import { units as shippedUnits } from './index';
import { swapColours } from './normalize';
import { legacyPlacementNotices, RETIRED_IDS, validateContent, validateUnits } from './validate';

const K = { e0: 'K', d9: 'k' };

/** Wraps exercises in a minimal valid unit/lesson using existing i18n keys. */
const unitWith = (...exercises: unknown[]) => [
  { id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises }] },
];
const errorsFor = (...exercises: unknown[]) => validateUnits(unitWith(...exercises));

describe('content validator', () => {
  it('accepts a minimal valid lesson of every exercise type', () => {
    expect(
      errorsFor(
        { type: 'learn', pieces: { ...K, a0: 'R' }, square: 'a0', text: 'u3l1.e1' },
        { type: 'select-squares', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' },
        { type: 'select-squares', pieces: K, region: 'red-palace', prompt: 'u1l1.e4' },
        { type: 'move', pieces: { ...K, a0: 'R' }, from: 'a0', goal: { kind: 'reach', squares: ['a7'] }, solution: { from: 'a0', to: 'a7' }, prompt: 'u3l1.e3' },
        { type: 'capture', pieces: { ...K, a0: 'R', a7: 'c' }, solution: { from: 'a0', to: 'a7' }, prompt: 'u3l1.e4' },
      ),
    ).toEqual([]);
  });

  it.each([
    ['a non-array root', {}, /non-empty array of units/],
    ['a unit without lessons', [{ id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [] }], /"lessons"/],
    ['an unknown i18n key', [{ id: 'u1', title: 'nope.key', description: 'u1.desc', lessons: [{ id: 'l', title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }] }], /nope\.key/],
    ['duplicate ids', [
      { id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1', title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }] },
    ], /duplicate id/],
  ])('rejects %s', (_name, input, pattern) => {
    expect(validateUnits(input).join('\n')).toMatch(pattern);
  });

  it.each([
    ['an unknown exercise type', { type: 'quiz', pieces: K }, /unknown type/],
    ['both fen and pieces', { type: 'learn', pieces: K, fen: '4k4/9/9/9/9/9/9/9/9/4K4 w', text: 'u1l1.e1' }, /exactly one of "fen" or "pieces"/],
    ['a broken FEN', { type: 'learn', fen: 'xyz', text: 'u1l1.e1' }, /invalid position/],
    ['a missing general', { type: 'learn', pieces: { e0: 'K' }, text: 'u1l1.e1' }, /invalid position/],
    ['the opponent already in check', { type: 'learn', pieces: { ...K, d5: 'R' }, text: 'u1l1.e1' }, /illegal position/],
    ['Black to move in a non-learn exercise', { type: 'select-squares', pieces: { ...K, a0: 'R' }, turn: 'black', square: 'a0', prompt: 'u3l1.e2' }, /Red must be to move/],
    ['a square without a Red piece', { type: 'select-squares', pieces: K, square: 'a0', prompt: 'u3l1.e2' }, /must hold a Red piece/],
    ['a bad square name', { type: 'learn', pieces: K, square: 'z9', text: 'u1l1.e1' }, /square name/],
    ['a piece with nothing to select', { type: 'select-squares', pieces: { ...K, a0: 'N', a1: 'R', b0: 'R' }, square: 'a0', prompt: 'u3l2.e3' }, /nothing to select/],
    ['an unknown region', { type: 'select-squares', pieces: K, region: 'moon', prompt: 'u1l1.e4' }, /unknown region/],
    ['a missing prompt key', { type: 'select-squares', pieces: K, region: 'red-palace' }, /"prompt"/],
    ['an unreachable goal square', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'reach', squares: ['b5'] }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /b5 cannot be reached/],
    ['an illegal solution', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'any' }, solution: { from: 'a0', to: 'b1' }, prompt: 'u3l1.e3' }, /not accepted \(illegal\)/],
    ['a solution that misses the goal', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'check' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /not accepted \(not-check\)/],
    ['an unknown goal', { type: 'move', pieces: { ...K, a0: 'R' }, goal: { kind: 'win' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e3' }, /goal\.kind/],
    ['a checkmate puzzle that also allows stalemate', {
      type: 'move', pieces: { d0: 'K', a8: 'R', h1: 'R', e9: 'k' }, goal: { kind: 'checkmate' }, solution: { from: 'h1', to: 'h9' }, prompt: 'u6l1.e4',
    }, /stalemates/],
    ['a capture puzzle with no winning capture', { type: 'capture', pieces: { ...K, a0: 'R', a5: 'p', a9: 'r' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /no capture wins material/],
    ['a capture solution that is not a capture', { type: 'capture', pieces: { ...K, a0: 'R', h7: 'c' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /no capture wins material|not-capture/],
    ['a losing capture as the solution', { type: 'capture', pieces: { ...K, a0: 'R', a5: 'p', a9: 'r', i0: 'R', i7: 'c' }, solution: { from: 'a0', to: 'a5' }, prompt: 'u3l1.e4' }, /not accepted \(not-best\)/],
    ['a pinned learn piece without allowNoMoves', { type: 'learn', pieces: { e0: 'K', e4: 'N', e9: 'k' }, square: 'e4', text: 'u1l1.e1' }, /allowNoMoves/],
  ])('rejects %s', (_name, exercise, pattern) => {
    const errors = errorsFor(exercise);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toMatch(pattern);
  });
});

describe('content validator: combinations, defend and tracks', () => {
  // Mate in 2 with two Chariots (from the shipped course): Ri7-i8 is quiet, then Ri9-g9 mates.
  const twoChariots = {
    type: 'combination',
    pieces: { c2: 'p', e9: 'k', f1: 'K', f4: 'p', g9: 'n', i7: 'R', i9: 'R' },
    prompt: 'u8l2.p1',
    goal: 'checkmate',
    moves: 2,
    solution: [
      { from: 'i7', to: 'i8' },
      { from: 'c2', to: 'c1' },
      { from: 'i9', to: 'g9' },
    ],
  };

  it('accepts a valid combination and a valid defend exercise', () => {
    const defend = {
      type: 'move',
      pieces: { b3: 'r', b9: 'C', e9: 'k', f1: 'K', g8: 'r', g9: 'N' },
      prompt: 'u9l3.p1',
      goal: { kind: 'defend' },
      solution: { from: 'g9', to: 'e8' },
    };
    expect(errorsFor(twoChariots, defend)).toEqual([]);
  });

  it.each([
    ['a wrong number of moves', { ...twoChariots, moves: 3 }, /already mates in 2/],
    ['an unsupported length', { ...twoChariots, moves: 5 }, /"moves" must be 2 to 4/],
    ['an unknown goal', { ...twoChariots, goal: 'draw' }, /"goal" must be/],
    ['a line that does not end with a Red move', { ...twoChariots, solution: twoChariots.solution.slice(0, 2) }, /alternate Red\/Black/],
    ['a first move that does not win', { ...twoChariots, solution: [{ from: 'f1', to: 'f0' }, ...twoChariots.solution.slice(1)] }, /not accepted \(wrong\)/],
    [
      'a reply that is not a best defence',
      {
        ...twoChariots,
        // After the quiet Pf8-e8 Black's best try is Cc8-c9 (two mates left); Ph3-h2 leaves three.
        pieces: { c8: 'c', d7: 'P', d9: 'k', e0: 'K', f8: 'P', h3: 'p', i4: 'N', i7: 'b' },
        solution: [
          { from: 'f8', to: 'e8' },
          { from: 'h3', to: 'h2' },
          { from: 'd7', to: 'd8' },
        ],
      },
      /not a best defence/,
    ],
    ['a missing hint key', { ...twoChariots, hints: ['nope.hint'] }, /nope\.hint/],
    ['a defend exercise without a threat', { type: 'move', pieces: { ...K, a0: 'R' }, prompt: 'u9l3.p1', goal: { kind: 'defend' }, solution: { from: 'a0', to: 'a1' } }, /no mate-in-1 threat/],
  ])('rejects %s', (_name, exercise, pattern) => {
    expect(errorsFor(exercise).join('\n')).toMatch(pattern);
  });

  const unit = (id: string, track?: string) => ({
    id,
    track,
    title: 'u1.title',
    description: 'u1.desc',
    lessons: [{ id: `${id}l`, title: 'u1l1.title', exercises: [{ type: 'learn', pieces: K, text: 'u1l1.e1' }] }],
  });

  it('checks tracks: known names, and units of one track kept together', () => {
    expect(validateUnits([unit('a'), unit('b', 'intermediate')])).toEqual([]);
    expect(validateUnits([unit('a', 'grandmaster')]).join('\n')).toMatch(/"track" must be one of/);
    expect(validateUnits([unit('a'), unit('b', 'intermediate'), unit('c')]).join('\n')).toMatch(/must be consecutive/);
  });

  describe('long combinations and deeper defence', () => {
    // Mate in 4 from the Expert track's generator: Ri5-i3 (takes the Chariot), ..., Ca3-a8 mate.
    const mateIn4 = {
      type: 'combination',
      pieces: { a3: 'C', b8: 'P', d7: 'a', d9: 'k', e6: 'R', e7: 'b', f2: 'K', g5: 'p', i3: 'r', i5: 'R' },
      prompt: 'u14l1.p',
      goal: 'checkmate',
      moves: 4,
      firstMoves: [{ from: 'i5', to: 'i3' }],
      solution: [
        { from: 'i5', to: 'i3' },
        { from: 'g5', to: 'g4' },
        { from: 'i3', to: 'i9' },
        { from: 'e7', to: 'g9' },
        { from: 'i9', to: 'g9' },
        { from: 'd9', to: 'd8' },
        { from: 'a3', to: 'a8' },
      ],
    };

    it('accepts a mate in 4 with its winning first moves listed', () => {
      expect(errorsFor(mateIn4)).toEqual([]);
    }, 120_000);

    it.each([
      ['a mate in 4 without firstMoves', { ...mateIn4, firstMoves: undefined }, /"firstMoves" is required/],
      ['firstMoves without the solution’s first move', { ...mateIn4, firstMoves: [{ from: 'f2', to: 'e2' }] }, /must include the first move of "solution"/],
      ['five moves', { ...mateIn4, moves: 5 }, /"moves" must be 2 to 4/],
    ])('rejects %s', (_name, exercise, pattern) => {
      expect(errorsFor(exercise).join('\n')).toMatch(pattern);
    });

    it('deep mode proves every listed first move wins', () => {
      const wrong = { ...mateIn4, firstMoves: [{ from: 'i5', to: 'i3' }, { from: 'f2', to: 'e2' }] };
      expect(errorsFor(wrong)).toEqual([]); // the quick check only plays the main line
      expect(validateUnits(unitWith(wrong), { deep: true }).join('\n')).toMatch(/firstMoves f2-e2 does not win/);
    }, 300_000);

    it('deep mode proves a firstMoves list is complete', () => {
      // Two Chariots, mate in 2: six first moves win, but only Ra5-a8 is listed.
      const incomplete = {
        type: 'combination',
        pieces: { a0: 'p', a5: 'R', d0: 'K', e9: 'k', i6: 'R' },
        prompt: 'u8l2.p1',
        goal: 'checkmate',
        moves: 2,
        firstMoves: [{ from: 'a5', to: 'a8' }],
        solution: [
          { from: 'a5', to: 'a8' },
          { from: 'a0', to: 'b0' },
          { from: 'i6', to: 'i9' },
        ],
      };
      expect(errorsFor(incomplete)).toEqual([]);
      const deep = validateUnits(unitWith(incomplete), { deep: true }).join('\n');
      expect(deep).toMatch(/missing the winning move a5-e5/);
      expect(deep).toMatch(/missing the winning move i6-i8/);
    });

    it('checks the depth of a defend goal', () => {
      // Black threatens mate in 2; only Ch2-h1 stops it (from the Advanced track's generator).
      const defend2 = {
        type: 'move',
        pieces: { a3: 'n', a6: 'n', b1: 'N', b3: 'c', d2: 'K', d7: 'a', e0: 'r', e8: 'k', f2: 'A', g1: 'p', h2: 'C', i3: 'N' },
        prompt: 'u11l3.p',
        goal: { kind: 'defend', depth: 2 },
        solution: { from: 'h2', to: 'h1' },
      };
      expect(errorsFor(defend2)).toEqual([]);
      expect(errorsFor({ ...defend2, goal: { kind: 'defend', depth: 4 } }).join('\n')).toMatch(/"goal.depth" must be 1, 2 or 3/);
      // As a mate-in-1 defence there is nothing to stop, which the validator reports.
      expect(errorsFor({ ...defend2, goal: { kind: 'defend', depth: 1 } }).join('\n')).toMatch(/no mate-in-1 threat/);
      // Proving the mate-in-2 defence takes ~15 s (30 s default timeout); explicit budget so a loaded run does not time out.
    }, 120_000);
  });
});


describe('content validator: schema v2 (new-course units, metadata, side, legality, pools)', () => {
  /** Full metadata of a practice item; learn cards need only id, version, status, source and side. */
  const meta = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    version: 1,
    status: 'draft',
    source: { kind: 'authored' },
    side: 'red',
    strand: 'TC',
    nature: 'tactic',
    critical: false,
    misconceptions: [],
    ...extra,
  });
  const learnMeta = (id: string) => ({ id, version: 1, status: 'draft', source: { kind: 'authored' }, side: 'red' });
  const newUnit = (exercises: unknown[], extra: Record<string, unknown> = {}) => ({
    id: 'b01',
    track: 'basics',
    title: 'u1.title',
    description: 'u1.desc',
    lessons: [{ id: 'b01l1', title: 'u1l1.title', exercises }],
    ...extra,
  });
  const errorsOf = (...units: unknown[]) => validateUnits(units);

  const learn = { ...learnMeta('b01l1-01'), type: 'learn', pieces: { ...K, a0: 'R' }, square: 'a0', text: 'u3l1.e1' };
  const select = { ...meta('b01l1-02'), type: 'select-squares', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' };

  // Black fixtures: Black to move, own-piece checks against Black.
  const blackPieces = { e0: 'K', d9: 'k', a9: 'r' };
  const blackSelect = { ...meta('b01l1-03', { side: 'black' }), type: 'select-squares', pieces: blackPieces, turn: 'black', square: 'a9', prompt: 'u3l1.e2' };
  const blackMove = {
    ...meta('b01l1-04', { side: 'black' }),
    type: 'move',
    pieces: blackPieces,
    turn: 'black',
    from: 'a9',
    goal: { kind: 'reach', squares: ['a2'] },
    solution: { from: 'a9', to: 'a2' },
    prompt: 'u3l1.e3',
  };
  const blackCapture = {
    ...meta('b01l1-05', { side: 'black' }),
    type: 'capture',
    pieces: { ...blackPieces, a2: 'C' },
    turn: 'black',
    solution: { from: 'a9', to: 'a2' },
    prompt: 'u3l1.e4',
  };
  // Colour-swapped twin of the Red defend fixture above: Red threatens mate, Black's Horse g0-e1 stops it.
  const blackDefend = {
    ...meta('b01l1-06', { side: 'black', strand: 'DE', critical: true, source: { kind: 'derived', derivedFrom: 'u9l3#1', transform: ['colour-swap'] } }),
    type: 'move',
    fen: toFen(swapColours(positionFromPieces({ b3: 'r', b9: 'C', e9: 'k', f1: 'K', g8: 'r', g9: 'N' }))),
    prompt: 'u9l3.p1',
    goal: { kind: 'defend' },
    solution: { from: 'g0', to: 'e1' },
  };

  it('accepts a new-course unit with full metadata, Red and Black items, and a pool', () => {
    const unit = newUnit([learn, select, blackSelect, blackMove, blackCapture, blackDefend], {
      pool: [{ ...select, id: 'b01-p01', misconceptions: ['b01.m1'], source: { kind: 'generated', generator: 'scripts/x.ts', seed: 7 } }],
    });
    expect(errorsOf(unit)).toEqual([]);
  });

  it('accepts a colour-swapped mate-in-2 combination played as Black', () => {
    // The two-Chariots fixture above, colour-swapped: Ri7-i8 becomes ...Ri2-i1 for Black.
    const combo = {
      ...meta('b01l1-01', { side: 'black', source: { kind: 'derived', derivedFrom: 'u8l2#1', transform: ['colour-swap'] } }),
      type: 'combination',
      fen: toFen(swapColours(positionFromPieces({ c2: 'p', e9: 'k', f1: 'K', f4: 'p', g9: 'n', i7: 'R', i9: 'R' }))),
      prompt: 'u8l2.p1',
      goal: 'checkmate',
      moves: 2,
      solution: [
        { from: 'i2', to: 'i1' },
        { from: 'c7', to: 'c8' },
        { from: 'i0', to: 'g0' },
      ],
    };
    expect(errorsOf(newUnit([combo]))).toEqual([]);
  });

  it('keeps metadata optional in legacy units, but type-checks it when present', () => {
    const legacy = (ex: unknown) => ({ id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises: [ex] }] });
    const plain = { type: 'select-squares', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' };
    expect(errorsOf(legacy(plain))).toEqual([]);
    expect(errorsOf(legacy({ ...plain, side: 'red', strand: 'RS', status: 'verified' }))).toEqual([]);
    expect(errorsOf(legacy({ ...plain, strand: 'XX' })).join('\n')).toMatch(/"strand" must be one of/);
  });

  it('requires every metadata field on new-course items (fewer on learn cards)', () => {
    const bare = { type: 'select-squares', id: 'b01l1-01', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' };
    const errors = errorsOf(newUnit([bare])).join('\n');
    for (const field of ['version', 'status', 'source', 'side', 'strand', 'nature', 'critical', 'misconceptions']) {
      expect(errors).toMatch(new RegExp(`"${field}" is required in a new-course unit`));
    }
    const learnErrors = errorsOf(newUnit([{ type: 'learn', id: 'b01l1-01', pieces: K, text: 'u1l1.e1' }])).join('\n');
    expect(learnErrors).toMatch(/"version" is required/);
    expect(learnErrors).not.toMatch(/"strand"|"nature"|"critical"|"misconceptions"/);
    expect(errorsOf(newUnit([{ ...select, id: undefined }])).join('\n')).toMatch(/"id" is required/);
  });

  it.each([
    ['a version below 1', { ...select, version: 0 }, /"version" must be an integer/],
    ['an unknown status', { ...select, status: 'final' }, /"status" must be one of draft, verified, reviewed, published, retired/],
    ['an unknown strand', { ...select, strand: 'XX' }, /"strand" must be one of/],
    ['an unknown nature', { ...select, nature: 'positional' }, /"nature" must be "tactic" or "quiet"/],
    ['a non-boolean critical', { ...select, critical: 'yes' }, /"critical" must be true or false/],
    ['a bad misconception id', { ...select, misconceptions: ['m2'] }, /misconception ids like "b06.m2"/],
    ['a repeated misconception id', { ...select, misconceptions: ['b01.m1', 'b01.m1'] }, /lists an id twice/],
    ['an unknown side', { ...select, side: 'blue' }, /"side" must be "red" or "black"/],
    ['an unknown source kind', { ...select, source: { kind: 'book' } }, /"source.kind" must be one of/],
    ['an unknown source field', { ...select, source: { kind: 'authored', author: 'me' } }, /"source.author" is not a known source field/],
    ['a generated item without seed', { ...select, source: { kind: 'generated', generator: 'scripts/x.ts' } }, /"source.seed" is required/],
    ['a derived item without transform', { ...select, source: { kind: 'derived', derivedFrom: 'b01l1-01' } }, /"source.transform" is required/],
    ['an unknown transform', { ...select, source: { kind: 'derived', derivedFrom: 'b01l1-01', transform: ['rotate'] } }, /"source.transform" must be/],
    ['a course-game item without move number', { ...select, source: { kind: 'course-game', gameId: 'g1' } }, /"source.moveNumber" is required/],
    ['a legacy item without legacyRef', { ...select, source: { kind: 'legacy' } }, /"source.legacyRef" is required/],
    ['a malformed legacyRef', { ...select, source: { kind: 'legacy', legacyRef: 'u7l1-2' } }, /"source.legacyRef" must be an old exercise/],
    ['a legacyRef to a lesson that never existed', { ...select, source: { kind: 'legacy', legacyRef: 'u99l1#0' } }, /is not an old lesson id/],
    ['a citation without locator', { ...select, source: { kind: 'authored', refs: [{ title: 'Rules', checkedBy: 'reviewer', checkedAt: '2026-11-02' }] } }, /"source.refs" must be/],
  ])('rejects %s', (_name, exercise, pattern) => {
    expect(errorsOf(newUnit([exercise])).join('\n')).toMatch(pattern);
  });

  it('accepts every source kind with its required fields', () => {
    const sources = [
      { kind: 'authored', refs: [{ title: 'Rules', locator: 'art. 23', checkedBy: 'content-reviewer', checkedAt: '2026-11-02' }] },
      { kind: 'generated', generator: 'scripts/generate-puzzles.ts', generatorVersion: '1', seed: 'abc' },
      { kind: 'derived', derivedFrom: 'm2-07', transform: ['file-mirror', 'colour-swap'] },
      { kind: 'course-game', gameId: 'cg-001', moveNumber: 12 },
      { kind: 'legacy', legacyRef: 'u7l1#2' },
      { kind: 'legacy', legacyRef: 'wm-03' },
    ];
    const items = sources.map((source, i) => ({ ...select, id: `b01l1-0${i + 1}`, source }));
    expect(errorsOf(newUnit(items))).toEqual([]);
  });

  it('checks new-course ids: patterns, uniqueness, retired ids', () => {
    expect(errorsOf(newUnit([{ ...select, id: 'b01l1-1' }])).join('\n')).toMatch(/id "b01l1-1" must match/);
    expect(errorsOf(newUnit([{ ...select, id: 'b02l1-01' }])).join('\n')).toMatch(/must match/);
    expect(errorsOf(newUnit([select, { ...select }])).join('\n')).toMatch(/duplicate id "b01l1-02"/);
    expect(errorsOf(newUnit([select], { lessons: [{ id: 'b01x', title: 'u1l1.title', exercises: [select] }] })).join('\n')).toMatch(
      /lesson id "b01x" must be "b01l" \+ a digit/,
    );
    // A pool item must be <unitId>-pNN and may not reuse a lesson item's id.
    expect(errorsOf(newUnit([select], { pool: [{ ...select, id: 'b01-01' }] })).join('\n')).toMatch(/id "b01-01" must match/);
    expect(errorsOf(newUnit([select], { pool: [select] })).join('\n')).toMatch(/duplicate id "b01l1-02"/);
    // Retired ids: unit, lesson and item ids are all checked.
    const retired = validateUnits([newUnit([select])], { retiredIds: ['b01', 'b01l1', 'b01l1-02'] }).join('\n');
    expect(retired).toMatch(/id "b01" is retired/);
    expect(retired).toMatch(/id "b01l1" is retired/);
    expect(retired).toMatch(/id "b01l1-02" is retired/);
    // Legacy units are exempt: their own ids are the retired ones.
    expect(validateUnits([{ id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises: [select] }] }])).toEqual([]);
  });

  it('requires a new-course unit to name the track of its id prefix', () => {
    expect(errorsOf(newUnit([select], { track: undefined })).join('\n')).toMatch(/needs "track": "basics"/);
    expect(errorsOf(newUnit([select], { id: 'i01', lessons: [{ id: 'i01l1', title: 'u1l1.title', exercises: [{ ...select, id: 'i01l1-01' }] }] })).join('\n')).toMatch(
      /needs "track": "intermediate"/,
    );
  });

  it('lists the retired ids: u1–u15, every old lesson id incl. u8l4 and the 9 orphans', () => {
    for (let n = 1; n <= 15; n++) {
      expect(RETIRED_IDS.has(`u${n}`)).toBe(true);
      for (let k = 1; k <= 3; k++) expect(RETIRED_IDS.has(`u${n}l${k}`)).toBe(true);
    }
    for (const orphan of ['u2l3', 'u3l3', 'u4l3', 'u5l1', 'u5l2', 'u5l3', 'u6l1', 'u6l2', 'u6l3']) expect(RETIRED_IDS.has(orphan)).toBe(true);
    for (const unit of shippedUnits) {
      expect(RETIRED_IDS.has(unit.id), unit.id).toBe(true);
      for (const lesson of unit.lessons) expect(RETIRED_IDS.has(lesson.id), lesson.id).toBe(true);
    }
    expect([...RETIRED_IDS].every((id) => /^u\d+(l\d)?$/.test(id))).toBe(true);
  });

  it('checks the side to move and own pieces against "side"', () => {
    expect(errorsOf(newUnit([{ ...blackSelect, turn: 'red' }])).join('\n')).toMatch(/Black must be to move/);
    expect(errorsOf(newUnit([{ ...select, side: 'black' }])).join('\n')).toMatch(/Black must be to move/);
    expect(errorsOf(newUnit([{ ...blackSelect, square: 'e0' }])).join('\n')).toMatch(/"square" e0 must hold a Black piece/);
    expect(errorsOf(newUnit([{ ...blackMove, from: 'e0' }])).join('\n')).toMatch(/"from" e0 must hold a Black piece/);
    // A Black defend item needs a Red threat.
    expect(errorsOf(newUnit([{ ...blackDefend, fen: undefined, pieces: blackPieces, turn: 'black', solution: { from: 'a9', to: 'a8' } }])).join('\n')).toMatch(
      /Red has no mate-in-1 threat/,
    );
  });

  it('validates a Black win-material combination now that the material judge is colour-neutral (S2.3)', () => {
    // The colour-swapped twin of u9l1#1 (ranks flipped, Black to move) validates like the original.
    const legacy = shippedUnits.flatMap((u) => u.lessons).find((l) => l.id === 'u9l1')!.exercises[1];
    if (legacy.type !== 'combination' || legacy.goal !== 'win-material' || legacy.pieces === undefined) throw new Error('u9l1#1 changed');
    const flip = (name: string) => `${name[0]}${9 - Number(name.slice(1))}`;
    const flipStep = (s: { from: string; to: string }) => ({ from: flip(s.from), to: flip(s.to) });
    const twin = {
      ...meta('b01l1-01', { side: 'black' }),
      type: 'combination',
      fen: toFen(swapColours(positionFromPieces(legacy.pieces, legacy.turn ?? 'red'))),
      prompt: legacy.prompt,
      goal: 'win-material',
      moves: legacy.moves,
      solution: legacy.solution.map(flipStep),
    };
    expect(errorsOf(newUnit([twin]))).toEqual([]);
    // A Black move that wins nothing is still refused, now by the colour-neutral judge.
    const quiet = { ...twin, solution: [{ from: 'f9', to: 'f8' }] };
    const errors = errorsOf(newUnit([quiet])).join('\n');
    expect(errors).not.toMatch(/cannot be played as Black/);
    expect(errors).toMatch(/solution\[0\] f9-f8 is not accepted \(wrong\)/);
  });

  it('fails unreachable points and extra pieces in new-course positions, and only reports them in legacy units', () => {
    // A Red Soldier on d3: before the river only files a, c, e, g, i are possible.
    const badSoldier = { ...select, pieces: { ...K, a0: 'R', d3: 'P' } };
    expect(errorsOf(newUnit([badSoldier])).join('\n')).toMatch(/illegal placement: red soldier on d3 can never stand there/);
    const threeChariots = { ...select, pieces: { ...K, a0: 'R', a1: 'R', a2: 'R' } };
    expect(errorsOf(newUnit([threeChariots])).join('\n')).toMatch(/illegal placement: too many red chariots \(3\)/);

    const legacy = [{ id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises: [badSoldier] }] }];
    const report = validateContent(legacy);
    expect(report.errors).toEqual([]);
    expect(report.notices).toEqual(['u1l1#0: red soldier on d3 can never stand there (legacy position, allowed while its lesson is live)']);
  });

  // 05-migration.md §9 command 3: 12 legacy positions with an unreachable Soldier, plus u13l2#4 with two
  // unpromoted Black Soldiers on one file (DECISIONS.md D5, rule added in S2.3); no piece-count failure.
  it('reports exactly the 13 legacy POS positions of the shipped content', () => {
    const notices = legacyPlacementNotices(shippedUnits);
    const refs = notices.map((n) => n.split(':')[0]);
    expect(refs).toEqual([
      'u1l3#4', 'u3l1#2', 'u3l2#3', 'u9l1#3', 'u9l1#5', 'u11l1#4', 'u12l1#1', 'u12l1#5', 'u12l2#2', 'u12l3#3', 'u13l1#0', 'u13l1#1', 'u13l2#4',
    ]);
    expect(notices.filter((n) => !n.startsWith('u13l2#4')).every((n) => / soldier on [a-i]\d can never stand there/.test(n))).toBe(true);
    expect(notices.find((n) => n.startsWith('u13l2#4'))).toMatch(/: 2 black soldiers on file a before the river \(a5, a6\)/);
  });

  it('validates a unit pool like lesson items', () => {
    const poolItem = { ...select, id: 'b01-p01' };
    expect(errorsOf(newUnit([select], { pool: [poolItem] }))).toEqual([]);
    expect(errorsOf(newUnit([select], { pool: 'x' })).join('\n')).toMatch(/"pool" must be an array/);
    expect(errorsOf(newUnit([select], { pool: [{ ...learn, id: 'b01-p01' }] })).join('\n')).toMatch(/b01\/pool\[0\]: a unit pool holds practice items only/);
    // The judges run on pool items: a solution that misses the goal fails.
    const wrongMove = { ...blackMove, id: 'b01-p01', solution: { from: 'a9', to: 'a3' } };
    expect(errorsOf(newUnit([select], { pool: [wrongMove] })).join('\n')).toMatch(/b01\/pool\[0\]: solution a9-a3 is not accepted \(wrong-target\)/);
    // Metadata is required on pool items of new-course units.
    expect(errorsOf(newUnit([select], { pool: [{ ...poolItem, strand: undefined }] })).join('\n')).toMatch(/b01\/pool\[0\]: "strand" is required/);
    // Legacy units may have a pool too (no metadata needed).
    const legacyUnit = { id: 'u1', title: 'u1.title', description: 'u1.desc', lessons: [{ id: 'u1l1', title: 'u1l1.title', exercises: [learn] }], pool: [{ type: 'select-squares', pieces: { ...K, a0: 'R' }, square: 'a0', prompt: 'u3l1.e2' }] };
    expect(errorsOf(legacyUnit)).toEqual([]);
  });
});
