// /docker/web-app/src/app/MainLayout.tsx
'use client';

import Sidebar from '../components/Sidebar';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export const shouldHideSidebar = (pathname: string) =>
  /^\/dashboard\/(dam-explorer|motion|live|witness)/.test(pathname);

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = shouldHideSidebar(pathname);

  return (
    <div className="flex flex-1 overflow-hidden">
      {!hideSidebar && <Sidebar />}
      <main
        className={clsx(
          'flex-1 overflow-auto transition-all',
          hideSidebar ? 'p-0' : 'p-6',
        )}
      >
        {children}
      </main>
    </div>
  );
}