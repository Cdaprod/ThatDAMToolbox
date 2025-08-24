/**
 * Tenant settings page renders tab labels.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import SettingsPage from '../settings/page';
import ToastProvider from '../../../providers/ToastProvider';

test('SettingsPage shows general tab', () => {
  const html = renderToString(
    <ToastProvider>
      <SettingsPage params={{ tenant: 'acme' }} />
    </ToastProvider>
  );
  assert.ok(html.includes('General &amp; Branding'));
});

