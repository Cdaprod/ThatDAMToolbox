/**
 * PolicyPreviewWidget render test.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import PolicyPreviewWidget from '../PolicyPreviewWidget';

test('PolicyPreviewWidget shows title', () => {
  const html = renderToString(<PolicyPreviewWidget />);
  assert.ok(html.includes('SSO Policy Preview'));
});
