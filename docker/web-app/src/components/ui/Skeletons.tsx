import React from 'react'
import { Shimmer } from '@cdaprod/ui-perf'

export { Shimmer }

export function CameraViewportSkeleton() {
  return (
    <Shimmer style={{ width: '100%', aspectRatio: '16/9' }} />
  )
}

export function ControlRowSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Shimmer key={i} style={{ height: 36, borderRadius: 6 }} />
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Shimmer key={i} style={{ height: 48, borderRadius: 8 }} />
      ))}
    </div>
  )
}

