/**
 * Login page renders Google sign in button.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import LoginPage from '../login/page';

test('LoginPage shows sign in heading', () => {
  const html = renderToString(<LoginPage />);
  assert.ok(html.includes('Sign in'));
});

