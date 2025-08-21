/**
 * Tests for the /api/tenancy route.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { POST } from '../tenancy/route';

test('POST /api/tenancy returns tenant credentials on success', async t => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  process.env.TENANCY_URL = 'http://tenancy.local';

  const body = { name: 'Demo' };
  global.fetch = async (url, init) => {
    assert.strictEqual(url, process.env.TENANCY_URL);
    assert.strictEqual(init?.method, 'POST');
    assert.deepStrictEqual(JSON.parse(String(init?.body)), body);
    return new Response(JSON.stringify({ tenantId: 't1', token: 'tok' }), {
      status: 200,
    });
  };

  const req = new Request('http://localhost/api/tenancy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const res = await POST(req);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.deepStrictEqual(data, { tenantId: 't1', token: 'tok' });
});

test('POST /api/tenancy surfaces upstream errors', async t => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  process.env.TENANCY_URL = 'http://tenancy.local';

  global.fetch = async () =>
    new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });

  const req = new Request('http://localhost/api/tenancy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Demo' }),
  });

  const res = await POST(req);
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('bad request'));
});
