// /docker/web-app/src/components/TopBar.tsx
'use client';

import clsx from 'clsx'
import { Menu } from 'lucide-react'
import { useModal } from '@/providers/ModalProvider'

export default function TopBar() {
  const { openModal } = useModal()
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
        <a href="/" className="font-semibold">
          That DAM Toolbox
        </a>
      </div>

      {/* right – placeholder for future buttons */}
      <nav className="flex items-center gap-4 text-sm">
        <button
          onClick={() => openModal('dam-explorer')}
          className="hover:text-teal-400"
        >
          Explorer
        </button>
      </nav>
    </header>
  );
}