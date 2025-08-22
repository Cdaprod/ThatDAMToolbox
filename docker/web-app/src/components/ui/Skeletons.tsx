import React from 'react'

export function Shimmer({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.06)',
        borderRadius: 8,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translateX(-100%)',
          background:
            'linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)',
          animation: 'shimmer 1.2s infinite',
        }}
      />
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

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

