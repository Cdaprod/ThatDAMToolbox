'use client'

import { useEffect, useState } from 'react'

export default function Home() {
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
    </main>
  )
}