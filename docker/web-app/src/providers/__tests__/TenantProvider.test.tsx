import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TenantProvider, { useTenant } from '../TenantProvider';

// Simple component to expose tenant from context
function ShowTenant() {
  const tenant = useTenant();
  return <span>{tenant}</span>;
}

test('TenantProvider exposes tenant via context', () => {
  const html = renderToString(
    <TenantProvider tenant="acme">
      <ShowTenant />
    </TenantProvider>
  );
  assert.ok(html.includes('acme'));
});
