import assert from 'node:assert';
import test from 'node:test';
import { getOrientation } from '../useOrientation';

test('detects portrait orientation', () => {
  const o = getOrientation({ innerWidth: 400, innerHeight: 800 });
  assert.equal(o, 'portrait');
});

test('detects landscape orientation', () => {
  const o = getOrientation({ innerWidth: 800, innerHeight: 400 });
  assert.equal(o, 'landscape');
});
