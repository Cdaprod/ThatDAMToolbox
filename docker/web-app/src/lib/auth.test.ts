/**
 * Tests for NextAuth configuration.
 *
 * Example:
 *   node --test src/lib/auth.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { authOptions } from './auth';

test('authOptions uses Google provider and JWT sessions', () => {
  assert.equal(authOptions.session?.strategy, 'jwt');
  const provider = authOptions.providers?.[0] as any;
  assert(provider && provider.id === 'google');
  assert.equal(authOptions.pages?.signIn, '/login');
});
