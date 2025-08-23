'use client'

import { useIsFetching } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Dim/blur content subtly during "in-between" states.
 * Uses presence of route change and active fetches.
 */
export default function GlobalBackdrop() {
  const pathname = usePathname()
  const fetching = useIsFetching()
  const [visible, setVisible] = useState(false)
  const routeTimer = useRef<number | null>(null)

  useEffect(() => {
    setVisible(true)
    routeTimer.current = window.setTimeout(() => {
      routeTimer.current = null
      if (fetching === 0) setVisible(false)
    }, 250)
    return () => {
      if (routeTimer.current) {
        clearTimeout(routeTimer.current)
        routeTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (fetching > 0) setVisible(true)
    else if (routeTimer.current === null) setVisible(false)
  }, [fetching])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        backdropFilter: visible ? 'blur(2px)' : 'none',
        transition: 'backdrop-filter 180ms ease',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    >
      {/* soft animated “pulse dots” to imply continuity */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          display: 'flex',
          gap: 6,
          opacity: visible ? 0.9 : 0,
          transition: 'opacity 200ms ease',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 8,
              background: 'rgba(0,0,0,.25)',
              animation: `pulse 900ms ${(i * 120)}ms infinite alternate ease-in-out`,
            }}
          />
        ))}
      </div>
      <style jsx global>{`
        @keyframes pulse {
          from { transform: translateY(0); opacity: 0.5; }
          to { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

