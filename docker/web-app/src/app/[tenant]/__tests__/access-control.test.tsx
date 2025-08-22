/**
 * Access control page render test.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import TenantProvider from '../../../providers/TenantProvider';
import AccessControlPage from '../access-control/page';

test('AccessControlPage shows heading', () => {
  const html = renderToString(
    <TenantProvider tenant="acme">
      <AccessControlPage />
    </TenantProvider>
  );
  assert.ok(html.includes('Access Control'));
});
