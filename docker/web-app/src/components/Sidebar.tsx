// /docker/web-app/src/components/Sidebar.tsx
'use client';
import Link from 'next/link'
import { dashboardTools } from './dashboardTools'
import clsx from 'clsx'
import { useSidebar } from '@/hooks/useSidebar'

export default function Sidebar() {
  const { collapsed, setCollapsed } = useSidebar()

  return (
    <aside
      className={clsx(
        'transition-all duration-300 bg-white/60 backdrop-blur border-r border-glass-border shadow-lg',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 w-full text-left text-sm font-semibold hover:bg-white/30"
      >
        {collapsed ? '▶' : 'Collapse ◀'}
      </button>

      <nav className="flex flex-col gap-1 px-2">
        {Object.values(dashboardTools).map(({ href, title, icon: Icon, id }) => (
          <Link
            key={id}
            href={href}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-white/40"
          >
            <Icon className="text-lg shrink-0" />
            {!collapsed && <span>{title}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}