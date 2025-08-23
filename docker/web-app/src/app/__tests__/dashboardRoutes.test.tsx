import React from 'react';
import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';

import HomePage from '../page';
import TenantDashboard from '../[tenant]/dashboard/page';
import TenantProvider from '../../providers/TenantProvider';
import { dashboardTools } from '../../components/dashboardTools';

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

// Root page now redirects; server render should be empty.
test('root page renders nothing (redirect)', () => {
  const homeHtml = renderToString(<HomePage />);
  assert.equal(homeHtml, '');
});
