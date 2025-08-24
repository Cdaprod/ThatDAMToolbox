// /docker/web-app/src/app/[tenant]/dashboard/layout.tsx
import DashboardShell from '@/components/DashboardShell';

export default function TenantDashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
