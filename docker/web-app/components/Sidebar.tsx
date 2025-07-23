// /docker/web-app/components/Sidebar.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { dashboardTools } from './dashboardTools';
import clsx from 'clsx';

export default function Sidebar() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={clsx(
        'transition-all duration-300 bg-white/60 backdrop-blur border-r border-glass-border shadow-lg',
        open ? 'w-64' : 'w-16',
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="p-3 w-full text-left text-sm font-semibold hover:bg-white/30"
      >
        {open ? 'Collapse ◀' : '▶'}
      </button>

      <nav className="flex flex-col gap-1 px-2">
        {dashboardTools.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-white/40"
          >
            <Icon className="text-lg shrink-0" />
            {open && <span>{title}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}