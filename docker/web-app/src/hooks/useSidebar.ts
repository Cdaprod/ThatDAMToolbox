'use client'
import { useState, useEffect } from 'react'

const KEY = 'sidebar-collapsed'
const defaultCollapsed = true

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    const stored = typeof window !== 'undefined' && localStorage.getItem(KEY)
    if (stored === null) {
      setCollapsed(defaultCollapsed)
    } else {
      setCollapsed(stored === 'true')
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY, String(collapsed))
    }
  }, [collapsed])

  return { collapsed, setCollapsed }
}
