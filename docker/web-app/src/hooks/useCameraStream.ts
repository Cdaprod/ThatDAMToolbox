'use client'
import { useEffect, useState } from 'react'

interface StreamInfo {
  src: string
  fallback: boolean
}

export function useCameraStream(): StreamInfo {
  const [info, setInfo] = useState<StreamInfo>({ src: '/hwcapture/live/stream.m3u8', fallback: false })
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    fetch('/hwcapture/live/stream.m3u8', { method: 'HEAD', signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('not ok')
        setInfo({ src: '/hwcapture/live/stream.m3u8', fallback: false })
      })
      .catch(() => {
        setInfo({ src: '/demo/bars720p30.mp4', fallback: true })
      })
      .finally(() => clearTimeout(timer))
    return () => controller.abort()
  }, [])
  return info
}
