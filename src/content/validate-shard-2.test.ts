import { describe, expect, it } from 'vitest';
import { validateUnits } from './validate';
import { shardUnits } from './validate-shard';

// New-course units k mod 4 = 2 (see validate-shard.ts). One unit per test; the timeout is per unit (the slowest unit,
// i08, takes ~100 s alone on a loaded machine).
const units = shardUnits(2);
describe('new-course content, shard 2', () => {
  if (units.length === 0) it('has no unit in this shard', () => expect(units).toEqual([]));
  // DEEP_CONTENT=1 (npm run content:deep) proves stored firstMoves lists here too, as in content.test.ts.
  for (const unit of units) it(`${unit.id} passes the validator`, () => expect(validateUnits([unit], { deep: process.env.DEEP_CONTENT === '1' })).toEqual([]), 600_000);
});
