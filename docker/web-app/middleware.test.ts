/**
 * Middleware redirects unauthenticated tenant routes to the pairing page and
 * tags responses with the tenant slug.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

test('sets tenant slug header without redirect', async () => {
  const req = new NextRequest('http://example.com/acme/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-tenant-slug'), 'acme');
});

test('redirects / when cookie present', async () => {
  const req = new NextRequest('http://example.com/', {
    headers: { cookie: 'cda_tenant=acme' },
  });
  const res = await middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'http://example.com/acme/dashboard');
});

test('redirects /dashboard using API fallback', async t => {
  const origFetch = global.fetch;
  t.after(() => { global.fetch = origFetch });
  global.fetch = async () => new Response(JSON.stringify({ tenant: 'beta' }), { status: 200 });
  const req = new NextRequest('http://example.com/dashboard');
  const res = await middleware(req);
  assert.equal(res.headers.get('location'), 'http://example.com/beta/dashboard');
});

test('falls back to /login when no tenant', async t => {
  const origFetch = global.fetch;
  t.after(() => { global.fetch = origFetch });
  global.fetch = async () => new Response('nope', { status: 500 });
  const req = new NextRequest('http://example.com/');
  const res = await middleware(req);
  assert.equal(res.headers.get('location'), 'http://example.com/login');
});

