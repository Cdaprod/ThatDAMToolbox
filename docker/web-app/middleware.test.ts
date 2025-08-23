/**
 * Middleware redirects unauthenticated tenant routes to the pairing page and
 * tags responses with the tenant slug.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

test('redirects to /pair when node_session cookie is missing', () => {
  const req = new NextRequest('http://example.com/acme/dashboard');
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'http://example.com/pair');
});

test('sets tenant slug header when session cookie is present', () => {
  const req = new NextRequest('http://example.com/acme/dashboard', {
    headers: { cookie: 'node_session=abc' },
  });
  const res = middleware(req);
  assert.equal(res.headers.get('x-tenant-slug'), 'acme');
  assert.equal(res.status, 200);
});

