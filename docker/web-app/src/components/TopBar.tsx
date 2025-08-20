// /docker/web-app/src/components/TopBar.tsx
'use client';

import clsx from 'clsx'
import { Menu, X } from 'lucide-react'
import { useSidebar } from '../hooks/useSidebar'
import { useModal } from '@/providers/ModalProvider'

export default function TopBar() {
  const { collapsed, setCollapsed } = useSidebar()
  const { openModal } = useModal()

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 flex h-12 items-center justify-between',
        'bg-surface border-b border-color-border shadow-md px-gutter-sm'
      )}
    >
      {/* left – brand / menu */}
      <div className="flex items-center gap-2">
        <button
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md text-color-muted hover:text-theme-primary hover:bg-color-primary-bg"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
        <a href="/" className="text-heading">
          That DAM Toolbox
        </a>
      </div>

      {/* right – placeholder for future buttons */}
      <nav className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => openModal('dam-explorer')}
          className="text-body hover:text-theme-primary"
        >
          Explorer
        </button>
      </nav>
    </header>
  );
}