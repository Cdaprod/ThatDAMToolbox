/**
 * Login page renders Google sign in button.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import LoginPage from '../login/page';

test('LoginPage shows Google sign in button', async () => {
  const html = renderToString(await LoginPage());
  assert.ok(html.includes('Sign in with Google'));
});

