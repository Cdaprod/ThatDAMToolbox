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
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const html = renderToString(await LoginPage());
  assert.ok(html.includes('Use development sign-in'));
});

test('LoginPage renders GIS button when Google is configured', async () => {
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'secret';
  const html = renderToString(await LoginPage());
  assert.ok(!html.includes('Use development sign-in'));
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

