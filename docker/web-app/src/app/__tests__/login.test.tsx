/**
 * Login page renders a development sign in link when Google OAuth is not
 * configured.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import LoginPage from '../login/page';

test('LoginPage shows development sign in when Google is missing', async () => {
  const html = renderToString(await LoginPage());
  assert.ok(html.includes('Use development sign-in'));
});

