'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { videoApi } from '../../lib/videoApi'
import UploadPicker from '../primitives/UploadPicker'
import { createToolPage } from '../../lib/toolRegistry'

/**
 * UI for the trim_idle video-api module.
 * Allows uploading a video and downloads the trimmed result.
 */
function TrimIdleContent() {
  const [file, setFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState<number>(2)
  const [status, setStatus] = useState<'idle' | 'working' | 'error' | 'done'>('idle')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit() {
    if (!file) return
    setStatus('working')
    try {
      const blob = await videoApi.trimIdle({ file, freeze_dur: threshold })
      setDownloadUrl(URL.createObjectURL(blob))
      setStatus('done')
    } catch (err) {
      setStatus('error')
    }
  }

  return (
    <>
      <UploadPicker
        onSelectFile={setFile}
        onSelectDam={() => router.push('/dashboard/dam-explorer')}
        onSelectCamera={() => router.push('/dashboard/camera-monitor')}
      />
      {file && (
        <video
          src={URL.createObjectURL(file)}
          controls
          className="w-full max-w-lg my-4"
        />
      )}
      <label className="block mb-4">
        <span className="mr-2">Idle Threshold (s)</span>
        <input
          type="number"
          className="border px-2 py-1 rounded w-20"
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
        />
      </label>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={handleSubmit}
        disabled={!file || status === 'working'}
      >
        Trim
      </button>
      {status === 'error' && (
        <p className="text-sm text-red-600">Failed to trim video</p>
      )}
      {downloadUrl && (
        <a
          className="text-sm text-blue-600 underline"
          href={downloadUrl}
          download="trimmed.mp4"
        >
          Download trimmed video
        </a>
      )}
    </>
  )
}

export default createToolPage('Trim Idle', TrimIdleContent)
