'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useIsFetching } from '@tanstack/react-query'

/**
 * A tiny top progress bar that reacts to both route changes (App Router)
 * and TanStack Query network activity. No external deps.
 */
export default function RouteProgress() {
  const pathname = usePathname()
  const isFetching = useIsFetching()
  const [active, setActive] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    // Start the bar when pathname changes
    setActive(true)
    // Ensure it stays visible for a minimum time to avoid flicker
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      // If no fetching, we’ll resolve after the microtask turns
      if (isFetching === 0) setActive(false)
    }, 300)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (isFetching > 0) setActive(true)
    else if (timerRef.current === null) setActive(false)
  }, [isFetching])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: active ? 3 : 0,
        width: active ? '100%' : 0,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(0,0,0,.2) 40%, rgba(0,0,0,.45) 60%, rgba(255,255,255,0) 100%)',
        transition: 'height 150ms ease, width 150ms ease',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}

