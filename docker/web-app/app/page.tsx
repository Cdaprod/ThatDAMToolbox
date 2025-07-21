// /app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import DAMApp from '../components/DAMApp';

export default function Page() {
  const [status, setStatus] = useState<{ status?: string }>({})

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error)
  }, [])

  return (
    <main style={{ padding: '2rem' }}>
      <h1>🎬 Video Dashboard</h1>
      <pre>{JSON.stringify(status, null, 2)}</pre>
      <DAMApp />
    </main>
  )
}