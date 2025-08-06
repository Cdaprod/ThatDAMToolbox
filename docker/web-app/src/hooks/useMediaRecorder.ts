// src/hooks/useMediaRecorder.ts
import { useRef, useState, useCallback } from 'react'

export interface RecorderOptions {
  /** target mime-types, in priority order */
  mimeTypes?: string[]
  /** outgoing bitrate */
  videoBitsPerSecond?: number
  /** frame-rate to request from the source */
  frameRate?: number
  /** ms between dataavailable events */
  chunkInterval?: number
}

export function useMediaRecorder({
  mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=h264'],
  videoBitsPerSecond = 2_500_000,
  frameRate = 30,
  chunkInterval = 100,
}: RecorderOptions = {}) {
  const [recording, setRecording] = useState(false)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async (videoEl: HTMLVideoElement) => {
    if (recorderRef.current) return
    chunksRef.current = []

    // cross-browser captureStream + canvas fallback
    async function obtainCaptureStream(el: HTMLVideoElement, fps: number): Promise<MediaStream> {
      // Standard API
      if (typeof (el as any).captureStream === 'function') {
        return (el as any).captureStream(fps)
      }
      // WebKit prefix
      if (typeof (el as any).webkitCaptureStream === 'function') {
        return (el as any).webkitCaptureStream(fps)
      }
      // Fallback: render to hidden canvas
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth || el.clientWidth
      canvas.height = el.videoHeight || el.clientHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas not supported')

      let rafId = 0
      const drawLoop = () => {
        try {
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
        } catch {}
        rafId = requestAnimationFrame(drawLoop)
      }
      drawLoop()

      const stream = (canvas as any).captureStream?.(fps) as MediaStream
      if (!stream) {
        cancelAnimationFrame(rafId)
        throw new Error('captureStream fallback failed')
      }
      // stop drawing when tracks end
      stream.getVideoTracks().forEach(track =>
        track.addEventListener('ended', () => cancelAnimationFrame(rafId), { once: true })
      )
      return stream
    }

    let stream: MediaStream
    try {
      stream = await obtainCaptureStream(videoEl, frameRate)
    } catch (err) {
      alert(`Unable to capture stream: ${err instanceof Error ? err.message : err}`)
      return
    }

    // wait until at least one video track is live
    const until = (fn: () => boolean) =>
      new Promise<void>((resolve, reject) => {
        if (fn()) return resolve()
        const iv = setInterval(() => fn() && (clearInterval(iv), resolve()), 50)
        setTimeout(() => (clearInterval(iv), reject(new Error('timeout'))), 2000)
      })

    try {
      await until(() => stream.getVideoTracks().length > 0)
    } catch {
      alert('No video tracks available -- is the camera live?')
      return
    }

    const mimeType =
      mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || mimeTypes[0]
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })

    rec.ondataavailable = e => {
      if (e.data.size) chunksRef.current.push(e.data)
    }

    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      recorderRef.current = null
      setRecording(false)
      setLastBlob(blob)
    }

    try {
      rec.start(chunkInterval)
    } catch {
      alert('Unable to start recording -- no media tracks found.')
      return
    }

    recorderRef.current = rec
    setRecording(true)
  }, [mimeTypes, videoBitsPerSecond, frameRate, chunkInterval])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (!rec) return
    rec.stop() // triggers onstop above
  }, [])

  const toggle = useCallback(
    (videoEl?: HTMLVideoElement) =>
      recording ? stop() : videoEl ? start(videoEl) : undefined,
    [recording, start, stop]
  )

  return { recording, lastBlob, start, stop, toggle }
}