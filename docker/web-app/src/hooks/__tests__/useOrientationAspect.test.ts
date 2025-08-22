import assert from 'node:assert';
import test from 'node:test';
import { getAspect } from '../useOrientationAspect';

test('calculates aspect ratio', () => {
  const aspect = getAspect({ width: 16, height: 9 });
  assert.notEqual(aspect, null);
  assert.ok(Math.abs((aspect as number) - 16 / 9) < 1e-6);
});

test('returns null for zero dimensions', () => {
  const aspect = getAspect({ width: 0, height: 10 });
  assert.equal(aspect, null);
});
