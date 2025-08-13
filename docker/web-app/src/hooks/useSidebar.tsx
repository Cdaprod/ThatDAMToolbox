'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const KEY = 'sidebar-collapsed'
const defaultCollapsed = true

type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: defaultCollapsed,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setCollapsed: () => {},
})

export function SidebarProvider({
  children,
  initialCollapsed = defaultCollapsed,
}: {
  children: ReactNode
  initialCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  useEffect(() => {
    const stored = typeof window !== 'undefined' && localStorage.getItem(KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY, String(collapsed))
    }
  }, [collapsed])

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
