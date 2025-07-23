'use client';

import '@/styles/globals.css';
import Providers from './providers';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export const metadata = {
  title: '🎬 Video Dashboard',
  description: 'Next.js + Python Video DAM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /** full-screen pages shouldn’t show the sidebar */
  const pathname = usePathname();
  const hideSidebar = /^\/dashboard\/(camera-monitor|dam-explorer|explorer|motion|live|witness)/.test(
    pathname,
  );

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
        <Providers>
          {/* GLOBAL TOP NAV -------------------------------------------------- */}
          <TopBar />

          {/* MAIN AREA ------------------------------------------------------- */}
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
        </Providers> 
      </body>
    </html>
  );
}