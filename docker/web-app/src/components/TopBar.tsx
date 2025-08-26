// /docker/web-app/src/components/TopBar.tsx
'use client';

import clsx from 'clsx'
import { Menu, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSidebar } from '../hooks/useSidebar'
import { useModal } from '@/providers/ModalProvider'
import { useTheme, AVAILABLE_SCHEMES, ColorScheme } from '@/context/ThemeContext'
import { useAuth } from '@/providers/AuthProvider'
import { useIsClient } from '@/hooks/useIsClient'
import ServiceStatusChip from './TopBar.ServiceStatusChip'

export default function TopBar() {
  const { collapsed, setCollapsed } = useSidebar()
  const { openModal } = useModal()
  const { scheme, setScheme } = useTheme()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isClient = useIsClient()
          
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!user) setMenuOpen(false)
  }, [user])

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
          disabled={!isClient}
          onClick={isClient ? () => setCollapsed(!collapsed) : undefined}
          className="p-2 rounded-md text-color-muted hover:text-theme-primary hover:bg-color-primary-bg"
        >
          {isClient && !collapsed ? <X size={20} /> : <Menu size={20} />}
        </button>
        <a href="/" className="text-heading">
          That DAM Toolbox
        </a>
      </div>

      {/* right – explorer & theme */}
      <nav className="flex items-center gap-4">
        <select
          aria-label="Select color scheme"
          value={scheme}
          onChange={e => setScheme(e.target.value as ColorScheme)}
          disabled={!isClient}
          className="input text-sm"
        >
          {AVAILABLE_SCHEMES.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ServiceStatusChip />
        <button
          type="button"
          disabled={!isClient}
          onClick={isClient ? () => openModal('dam-explorer') : undefined}
          className="text-body hover:text-theme-primary"
        >
          Explorer
        </button>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="w-8 h-8 rounded-full bg-color-primary-bg text-sm flex items-center justify-center"
              onClick={() => setMenuOpen(o => !o)}
            >
              {user.name?.[0] ?? 'U'}
            </button>
            {menuOpen && (
              <div
                role="menu"
                tabIndex={-1}
                className="absolute right-0 mt-2 bg-surface border border-color-border rounded shadow-md"
                onBlur={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenuOpen(false)
                }}
              >
                <a
                  href="/account"
                  role="menuitem"
                  className="block px-4 py-2 text-sm hover:bg-color-primary-bg"
                  onClick={() => setMenuOpen(false)}
                >
                  Account
                </a>
                <button
                  role="menuitem"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-color-primary-bg"
                  onClick={() => {
                    logout()
                    setMenuOpen(false)
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}