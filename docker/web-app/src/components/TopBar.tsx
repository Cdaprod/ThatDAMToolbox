// /docker/web-app/src/components/TopBar.tsx
'use client';

import Link from 'next/link';
import { clsx } from 'clsx';          // you already have clsx
import { Menu } from 'lucide-react';  // any icon you like

export default function TopBar() {
  return (
    <header
      className={clsx(
        'sticky top-0 z-50 flex h-12 items-center',
        'justify-between bg-gray-900 px-4 text-gray-100 shadow-md'
      )}
    >
      {/* left – brand / menu */}
      <div className="flex items-center gap-2">
        <Menu size={20} className="md:hidden" />
        <Link href="/" className="font-semibold">
          That DAM Toolbox
        </Link>
      </div>

      {/* right – placeholder for future buttons */}
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="hover:text-teal-400">
          Dashboard
        </Link>
        <Link href="/explorer" className="hover:text-teal-400">
          Explorer
        </Link>
      </nav>
    </header>
  );
}