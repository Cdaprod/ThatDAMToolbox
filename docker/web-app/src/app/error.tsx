'use client'

import { useEffect } from 'react'

export default function RootError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    // hook in your telemetry here if needed
    // console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center'
    }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>Something went sideways</h2>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>
          We kept the shell alive so you can retry without losing context.
        </p>
        <button onClick={() => reset()} style={{ padding: '8px 14px', borderRadius: 6 }}>
          Try again
        </button>
      </div>
    </div>
  )
}

