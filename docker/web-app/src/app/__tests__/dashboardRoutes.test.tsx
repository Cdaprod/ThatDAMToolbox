import React from 'react';
import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';

import HomePage from '../page';
import TenantDashboard from '../[tenant]/dashboard/page';
import TenantProvider from '../../providers/TenantProvider';
import { dashboardTools } from '../../components/dashboardTools';

test('default and tenant dashboards render the same tools', () => {
  const homeHtml = renderToString(<HomePage />);
  const tenantHtml = renderToString(
    <TenantProvider tenant="acme">
      <TenantDashboard />
    </TenantProvider>,
  );

  Object.values(dashboardTools).forEach(tool => {
    assert.ok(homeHtml.includes(tool.title), `home missing ${tool.title}`);
    assert.ok(tenantHtml.includes(tool.title), `tenant missing ${tool.title}`);
  });
});
