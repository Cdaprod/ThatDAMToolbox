/**
 * Tests for the React Query devtools resolver.
 *
 * Example:
 *   node --test src/providers/loadReactQueryDevtools.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickDevtools } from './loadReactQueryDevtools';

const noop = () => null;

test('selects named ReactQueryDevtools export when present', () => {
  const mod = pickDevtools({ ReactQueryDevtools: noop });
  assert.equal(mod.default, noop);
});

test('falls back to default export when named export missing', () => {
  const mod = pickDevtools({ default: noop });
  assert.equal(mod.default, noop);
});

test('returns no-op component when exports missing', () => {
  const mod = pickDevtools({});
  assert.equal(typeof mod.default, 'function');
  assert.equal(mod.default(), null);
});
