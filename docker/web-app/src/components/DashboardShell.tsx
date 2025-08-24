// /docker/web-app/src/components/DashboardShell.tsx
'use client';

import clsx from 'clsx';
import { usePathname } from 'next/navigation';

import TopBar from './TopBar';
import Sidebar from './Sidebar';
import { SidebarProvider } from '@/hooks/useSidebar';

export const shouldHideSidebar = (pathname: string) =>
  /^\/[^/]+\/dashboard\/(dam-explorer|layered-explorer|motion|live|witness)/.test(
    pathname,
  );

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = shouldHideSidebar(pathname ?? '');

  return (
    <SidebarProvider>
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main
            className={clsx(
              'flex-1 overflow-auto transition-all',
              hideSidebar ? 'p-0' : 'p-6',
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}