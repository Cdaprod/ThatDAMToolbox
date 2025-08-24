/**
 * Tests for the /api/library/stats route.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { GET } from '../stats/route';

test('GET /api/library/stats returns stub stats when media-api unavailable', async () => {
  delete process.env.MEDIA_API_BASE_URL; // ensure stub path in test
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
