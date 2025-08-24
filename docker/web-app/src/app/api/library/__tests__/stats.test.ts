/**
 * Tests for the /api/library/stats route.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../stats/route';

test('GET /api/library/stats returns placeholder stats', async () => {
  const res = await GET(new Request('http://localhost/api/library/stats'));
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.deepStrictEqual(data, {
    assets: 0,
    batches: 0,
    lastIngest: null,
    source: 'stub',
    assetsList: [],
  });
});
