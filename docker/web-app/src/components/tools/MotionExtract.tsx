'use client'

import { useState } from 'react'
import { videoApi } from '../../lib/videoApi'

/**
 * Minimal motion extraction tool.
 * Allows selecting a file path and triggers extraction via API.
 */
export default function MotionExtract() {
  const [path, setPath] = useState('')
  const [status, setStatus] = useState('idle')

  async function extract() {
    if (!path) return
    setStatus('working')
    try {
      const job = await videoApi.motionExtract({ path })
      setStatus(job.status)
    } catch (err: any) {
      setStatus('error')
    }
  }

  return (
    <section className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Motion Extract</h2>
      <input
        className="border rounded p-2 w-full"
        placeholder="/path/to/video.mp4"
        value={path}
        onChange={(e) => setPath(e.target.value)}
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={extract}
        disabled={!path || status === 'working'}
      >
        Extract
      </button>
      <p className="text-sm text-gray-700">Status: {status}</p>
    </section>
  )
}
