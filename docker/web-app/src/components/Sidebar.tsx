// /docker/web-app/src/components/Sidebar.tsx
'use client';
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dashboardTools } from './dashboardTools'
import clsx from 'clsx'
import { useSidebar } from '../hooks/useSidebar'

export default function Sidebar() {
  const { collapsed } = useSidebar()
  const pathname = usePathname() || ''

  return (
    <aside
      className={clsx(
        'h-full overflow-hidden bg-surface border-r border-color-border shadow-lg transition-all duration-300',
        collapsed ? 'w-0 md:w-16' : 'w-64'
      )}
    >
      <nav className="flex flex-col gap-1 px-2 py-2">
        {Object.values(dashboardTools).map(({ href, title, icon: Icon, id }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={id}
              href={href}
              className={clsx(
                'flex items-center gap-3 p-2 rounded-md hover:bg-surface',
                active && 'bg-color-primary-bg text-theme-primary font-semibold'
              )}
            >
              <Icon className="text-lg shrink-0" />
              {!collapsed && <span className="text-body">{title}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  );
}