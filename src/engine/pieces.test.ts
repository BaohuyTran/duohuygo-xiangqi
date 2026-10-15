import { describe, expect, it } from 'vitest';
import { targets } from './test-utils';

// Coordinates: files a..i left to right from Red's side, ranks 0..9 from Red's back rank.
// Unless noted, the generals sit on different files (d0 / f9) so the flying-general rule
// does not interfere with the piece under test.
const KINGS = { d0: 'K', f9: 'k' };

describe('general', () => {
  it('steps one point orthogonally from the palace centre', () => {
    // A red soldier on e5 keeps the generals apart; d9/f9 are empty so d1/f1 are safe.
    expect(targets({ e1: 'K', e5: 'P', e9: 'k' }, 'e1')).toEqual(['d1', 'e0', 'e2', 'f1']);
  });

  it('cannot leave the palace from a corner', () => {
    expect(targets({ d0: 'K', f9: 'k' }, 'd0')).toEqual(['d1', 'e0']);
    expect(targets({ d2: 'K', f9: 'k' }, 'd2')).toEqual(['d1', 'e2']);
  });

  it('black general is confined to its own palace', () => {
    expect(targets({ d0: 'K', f7: 'k' }, 'f7', 'black')).toEqual(['e7', 'f8']);
  });

  it('captures an attacker and escapes check', () => {
    // Black soldier on d1 (crossed the river) checks the general on e1.
    expect(targets({ e1: 'K', d1: 'p', e5: 'P', e9: 'k' }, 'e1')).toEqual(['d1', 'e0', 'e2', 'f1']);
  });

  it('may not step onto a square defended by an enemy piece', () => {
    // Black chariot on f5 controls the f-file.
    expect(targets({ e1: 'K', f5: 'r', e5: 'P', e9: 'k' }, 'e1')).toEqual(['d1', 'e0', 'e2']);
  });

  describe('flying general', () => {
    it('cannot move onto an open file facing the enemy general', () => {
      expect(targets({ d0: 'K', e9: 'k' }, 'd0')).toEqual(['d1']);
    });

    it('a piece between the generals is pinned to that file', () => {
      // The horse is the only thing separating the generals, so it cannot move.
      expect(targets({ e0: 'K', e4: 'N', e9: 'k' }, 'e4')).toEqual([]);
    });

    it('a pinned cannon may still slide along the shared file', () => {
      // Without a screen it cannot capture the general, and leaving the file would expose its own.
      expect(targets({ e0: 'K', e4: 'C', e9: 'k' }, 'e4')).toEqual(['e1', 'e2', 'e3', 'e5', 'e6', 'e7', 'e8']);
    });

    it('a piece may leave the file when another piece still separates the generals', () => {
      expect(targets({ e0: 'K', e4: 'N', e6: 'p', e9: 'k' }, 'e4')).toEqual([
        'c3',
        'c5',
        'd2',
        'd6',
        'f2',
        'f6',
        'g3',
        'g5',
      ]);
    });
  });
});

describe('advisor', () => {
  it('steps diagonally from the palace centre to all four corners', () => {
    expect(targets({ e0: 'K', e1: 'A', d9: 'k' }, 'e1')).toEqual(['d0', 'd2', 'f0', 'f2']);
  });

  it('can only return to the centre from a corner', () => {
    expect(targets({ e0: 'K', d0: 'A', f9: 'k' }, 'd0')).toEqual(['e1']);
    expect(targets({ e0: 'K', f9: 'a', d9: 'k' }, 'f9', 'black')).toEqual(['e8']);
  });

  it('is blocked by its own pieces and captures enemy pieces', () => {
    expect(targets({ d0: 'K', e1: 'A', f2: 'c', e9: 'k' }, 'e1')).toEqual(['d2', 'f0', 'f2']);
  });
});

describe('elephant', () => {
  it('moves two points diagonally', () => {
    expect(targets({ ...KINGS, e2: 'B' }, 'e2')).toEqual(['c0', 'c4', 'g0', 'g4']);
  });

  it('is blocked when the eye is occupied by any piece', () => {
    // Own soldier on d3 blocks c4; enemy soldier on f1 blocks g0.
    expect(targets({ ...KINGS, e2: 'B', d3: 'P', f1: 'p' }, 'e2')).toEqual(['c0', 'g4']);
  });

  it('cannot cross the river', () => {
    expect(targets({ ...KINGS, c4: 'B' }, 'c4')).toEqual(['a2', 'e2']);
    expect(targets({ ...KINGS, g5: 'b' }, 'g5', 'black')).toEqual(['e7', 'i7']);
  });

  it('captures on its destination but not its own pieces', () => {
    expect(targets({ ...KINGS, e2: 'B', g4: 'r', c0: 'R' }, 'e2')).toEqual(['c4', 'g0', 'g4']);
  });

  it('stays on the board at the edge', () => {
    expect(targets({ ...KINGS, a2: 'B' }, 'a2')).toEqual(['c0', 'c4']);
  });
});

describe('horse', () => {
  it('makes all eight L-moves from an open square', () => {
    expect(targets({ ...KINGS, e4: 'N' }, 'e4')).toEqual(['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5']);
  });

  it('is blocked by a piece on the adjacent leg square', () => {
    // e5 blocks d6/f6, d4 blocks c3/c5.
    expect(targets({ ...KINGS, e4: 'N', e5: 'p', d4: 'P' }, 'e4')).toEqual(['d2', 'f2', 'g3', 'g5']);
  });

  it('is not blocked by diagonal neighbours', () => {
    expect(targets({ ...KINGS, e4: 'N', d5: 'P', f3: 'P' }, 'e4')).toHaveLength(8);
  });

  it('captures enemy pieces but not its own', () => {
    expect(targets({ ...KINGS, e4: 'N', f6: 'r', d2: 'P' }, 'e4')).toEqual(['c3', 'c5', 'd6', 'f2', 'f6', 'g3', 'g5']);
  });

  it('respects the board edge', () => {
    expect(targets({ ...KINGS, a0: 'N' }, 'a0')).toEqual(['b2', 'c1']);
  });
});

describe('chariot', () => {
  it('slides orthogonally across the board and the river', () => {
    const moves = targets({ ...KINGS, e4: 'R' }, 'e4');
    expect(moves).toHaveLength(17);
    expect(moves).toContain('e9');
    expect(moves).toContain('a4');
    expect(moves).toContain('i4');
  });

  it('stops before its own pieces and on enemy pieces', () => {
    expect(targets({ ...KINGS, e4: 'R', e6: 'p', c4: 'P', e2: 'P', h4: 'c' }, 'e4')).toEqual([
      'd4',
      'e3',
      'e5',
      'e6',
      'f4',
      'g4',
      'h4',
    ]);
  });
});

describe('cannon', () => {
  it('moves like a chariot when not capturing', () => {
    expect(targets({ ...KINGS, e4: 'C' }, 'e4')).toHaveLength(17);
  });

  it('captures only by jumping exactly one screen', () => {
    // e6 is the screen, e8 is captured; e6 itself and e7 are unreachable.
    expect(targets({ ...KINGS, a4: 'P', i4: 'P', e3: 'P', e4: 'C', e6: 'p', e8: 'r' }, 'e4')).toEqual([
      'b4',
      'c4',
      'd4',
      'e5',
      'e8',
      'f4',
      'g4',
      'h4',
    ]);
  });

  it('may use its own piece as the screen', () => {
    expect(targets({ ...KINGS, e4: 'C', e6: 'P', e8: 'r' }, 'e4')).toContain('e8');
  });

  it('cannot capture without a screen', () => {
    expect(targets({ ...KINGS, e4: 'C', e5: 'r' }, 'e4')).not.toContain('e5');
  });

  it('captures only the first piece after the screen', () => {
    const moves = targets({ ...KINGS, e4: 'C', e5: 'p', e6: 'r', e7: 'n' }, 'e4');
    expect(moves).toContain('e6');
    expect(moves).not.toContain('e7');
  });

  it('cannot capture its own piece behind a screen', () => {
    expect(targets({ ...KINGS, e4: 'C', e5: 'p', e6: 'P' }, 'e4')).not.toContain('e6');
  });
});

describe('soldier', () => {
  it('only moves forward before crossing the river', () => {
    expect(targets({ ...KINGS, e3: 'P' }, 'e3')).toEqual(['e4']);
    expect(targets({ ...KINGS, e4: 'P' }, 'e4')).toEqual(['e5']);
    expect(targets({ ...KINGS, e6: 'p' }, 'e6', 'black')).toEqual(['e5']);
  });

  it('may also move sideways after crossing the river', () => {
    expect(targets({ ...KINGS, e5: 'P' }, 'e5')).toEqual(['d5', 'e6', 'f5']);
    expect(targets({ ...KINGS, e4: 'p' }, 'e4', 'black')).toEqual(['d4', 'e3', 'f4']);
  });

  it('respects the board edge', () => {
    expect(targets({ ...KINGS, a5: 'P' }, 'a5')).toEqual(['a6', 'b5']);
  });

  it('only moves sideways on the last rank and never backward', () => {
    expect(targets({ d0: 'K', f8: 'k', e9: 'P' }, 'e9')).toEqual(['d9', 'f9']);
  });

  it('captures the same way it moves', () => {
    expect(targets({ ...KINGS, e5: 'P', e6: 'r', d5: 'P', f5: 'n' }, 'e5')).toEqual(['e6', 'f5']);
  });
});
