/**
 * Account page basic render test.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AccountPage from '../account/page';

test('AccountPage shows heading', () => {
  const html = renderToString(<AccountPage />);
  assert.ok(html.includes('Account'));
});

