/**
 * Account page basic render test.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AccountPage from '../account/page';
import ToastProvider from '@/providers/ToastProvider';

test('AccountPage renders without crashing', () => {
  const html = renderToString(
    <ToastProvider>
      <AccountPage />
    </ToastProvider>
  );
  assert.equal(html, '');
});

