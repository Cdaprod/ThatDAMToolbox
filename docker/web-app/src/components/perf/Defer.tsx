'use client'
import { useEffect, useState } from 'react'

export function DeferIdle({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const rIC = (cb: () => void) =>
      (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 120)
    const id = rIC(() => setReady(true))
    return () => (window as any).cancelIdleCallback?.(id)
  }, [])
  return ready ? <>{children}</> : null
}

export function DeferVisible({ children, rootMargin = '200px' }:{ children: React.ReactNode; rootMargin?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const el = document.getElementById('__defer_visible_target__')
    if (!el) return setReady(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setReady(true), io.disconnect()), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return (
    <>
      <div id="__defer_visible_target__" style={{ position:'absolute', inset: '-1px auto auto -1px', width:1, height:1 }} />
      {ready ? <>{children}</> : null}
    </>
  )
}

