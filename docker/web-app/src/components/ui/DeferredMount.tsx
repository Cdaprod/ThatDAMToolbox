'use client'

import { useEffect, useState } from 'react'

/**
 * Mount children after a tiny delay to avoid thrash during route swaps.
 * Great for heavy canvases/NDI renderers.
 */
export default function DeferredMount({ delay = 120, children }:{ delay?: number; children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return ready ? <>{children}</> : null
}

