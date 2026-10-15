import { describe, expect, it } from 'vitest';
import { parseFen, perft, START_FEN } from './index';

// Reference counts from the Chess Programming Wiki "Chinese Chess Perft Results" page,
// which agree with independent results posted on talkchess.com.
describe('perft from the starting position', () => {
  const start = parseFen(START_FEN);

  it.each([
    [1, 44],
    [2, 1_920],
    [3, 79_666],
    [4, 3_290_240],
  ])('depth %i = %i nodes', (depth, nodes) => {
    expect(perft(start, depth)).toBe(nodes);
  });
});
