/**
 * Pair page renders an initial heading without requiring network calls.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PairPage from '../pair/page';

test('PairPage shows heading', () => {
  const html = renderToString(<PairPage />);
  assert.ok(html.includes('Pair this node'));
});

