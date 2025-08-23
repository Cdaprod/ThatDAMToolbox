/**
 * Tests for NextAuth configuration.
 *
 * Example:
 *   node --test src/lib/auth.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthOptions } from './auth';

test('falls back to credentials provider when Google env vars are missing', () => {
  const origId = process.env.GOOGLE_CLIENT_ID;
  const origSecret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const opts = buildAuthOptions();
  assert.equal(opts.providers?.[0]?.id, 'credentials');
  assert.equal(opts.session?.strategy, 'jwt');
  assert.equal(opts.pages?.signIn, '/login');
  process.env.GOOGLE_CLIENT_ID = origId;
  process.env.GOOGLE_CLIENT_SECRET = origSecret;
});

test('uses Google provider when credentials are configured', () => {
  const origId = process.env.GOOGLE_CLIENT_ID;
  const origSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'secret';
  const opts = buildAuthOptions();
  assert.equal(opts.providers?.[0]?.id, 'google');
  process.env.GOOGLE_CLIENT_ID = origId;
  process.env.GOOGLE_CLIENT_SECRET = origSecret;
});
