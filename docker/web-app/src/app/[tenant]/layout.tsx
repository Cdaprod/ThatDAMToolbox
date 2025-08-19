// /docker/web-app/src/app/[tenant]/layout.tsx
// Layout that injects the tenant context for nested routes.

import TenantProvider from '../../providers/TenantProvider';

export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  return <TenantProvider tenant={params.tenant}>{children}</TenantProvider>;
}
