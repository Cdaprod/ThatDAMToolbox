// /docker/web-app/src/components/Sidebar.tsx
'use client';
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dashboardTools } from './dashboardTools'
import clsx from 'clsx'
import { useSidebar } from '../hooks/useSidebar'
import { useTenant } from '@/providers/TenantProvider'
import { useIsClient } from '@/hooks/useIsClient'

export default function Sidebar() {
  const { collapsed } = useSidebar()
  const pathname = usePathname() || ''
  const tenant = useTenant()
  const isClient = useIsClient()
  const effectiveCollapsed = isClient ? collapsed : false

  return (
    <aside
      className={clsx(
        'h-full overflow-hidden bg-surface border-r border-color-border shadow-lg transition-all duration-300',
        effectiveCollapsed ? 'w-0 md:w-16' : 'w-64'
      )}
    >
      <nav className="flex flex-col gap-1 px-2 py-2">
        {Object.values(dashboardTools).map(({ href, title, icon: Icon, id }) => {
          const fullHref = `/${tenant}${href}`
          const active = pathname.startsWith(fullHref)
          return (
            <Link
              key={id}
              href={fullHref}
              className={clsx(
                'flex items-center gap-3 p-2 rounded-md hover:bg-surface',
                active && 'bg-color-primary-bg text-theme-primary font-semibold'
              )}
            >
              <Icon className="text-lg shrink-0" />
              {!effectiveCollapsed && <span className="text-body">{title}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  );
}