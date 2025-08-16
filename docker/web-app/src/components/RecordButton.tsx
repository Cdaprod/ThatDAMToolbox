// /docker/web-app/src/components/RecordButton.tsx
'use client'
import { useState } from 'react'

interface Props {
  onStart: () => Promise<void> | void
  onStop: () => Promise<void> | void
}

export default function RecordButton({ onStart, onStop }: Props) {
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    if (pending) return
    setPending(true)
    try {
      if (recording) {
        await onStop()
        setRecording(false)
      } else {
        await onStart()
        setRecording(true)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`w-full p-2 mb-1 rounded text-white text-xs transition-colors ${recording ? 'bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
    >
      {recording ? '⏸ STOP REC' : '● RECORD'}
    </button>
  )
}
