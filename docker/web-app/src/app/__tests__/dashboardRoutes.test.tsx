import React from 'react';
import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';

import TenantDashboard from '../[tenant]/dashboard/page';
import TenantProvider from '@/providers/TenantProvider';
import { dashboardTools } from '@/components/dashboardTools';
import { mock } from 'node:test';

// Ensure tenant dashboards render all configured tools.
test('tenant dashboard renders expected tools', () => {
  const tenantHtml = renderToString(
    <TenantProvider tenant="acme">
      <TenantDashboard />
    </TenantProvider>,
  );

  Object.values(dashboardTools).forEach(tool => {
    assert.ok(tenantHtml.includes(tool.title), `tenant missing ${tool.title}`);
  });
});

// Root page redirects unauthenticated users to the login screen.
test('root page redirects to login when unauthenticated', async () => {
  const navigation = await import('next/navigation');
  const redirectMock = mock.method(navigation, 'redirect', (url: string) => {
    throw new Error(url);
  });

  global.fetch = async () => ({ ok: false }) as any;

  const { default: HomePage } = await import('../page');

  let err: any;
  try {
    await HomePage();
  } catch (e) {
    err = e;
  }

  assert.equal(err?.message, '/login');
  assert.equal(redirectMock.mock.callCount(), 1);
});
