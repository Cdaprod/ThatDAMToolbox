/**
 * Tenant settings page renders tab labels.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import TenantProvider from '../../../providers/TenantProvider';
import SettingsPage from '../settings/page';

test('SettingsPage shows general tab', () => {
  const html = renderToString(
    <TenantProvider tenant="acme">
      <SettingsPage />
    </TenantProvider>
  );
  assert.ok(html.includes('General'));
});

