import assert from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../evaluate/route';

test('policy evaluation allows domain', async () => {
  const req = new NextRequest('http://test', { method: 'POST', body: JSON.stringify({ tenant: 'demo', email: 'a@gmail.com' }) });
  const res = await POST(req);
  const data = await res.json();
  assert.equal(data.allowed, true);
});

