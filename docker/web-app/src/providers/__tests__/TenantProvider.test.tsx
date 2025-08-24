import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TenantProvider, { useTenant } from '../TenantProvider';
import * as navigation from 'next/navigation';
import { mock } from 'node:test';

// Default mocks for pathname and search params used by TenantProvider
mock.method(navigation, 'usePathname', () => '/acme/dashboard');
mock.method(navigation, 'useSearchParams', () => new URLSearchParams());

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

test('TenantProvider derives tenant from route params when prop missing', () => {
  const paramsMock = mock.method(navigation, 'useParams', () => ({ tenant: 'demo' }));
  const html = renderToString(
    <TenantProvider>
      <ShowTenant />
    </TenantProvider>,
  );
  assert.ok(html.includes('demo'));
  paramsMock.mock.restore();
});
