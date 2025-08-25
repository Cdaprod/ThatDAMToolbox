'use client';

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadPicker from '../primitives/UploadPicker'
import TimelineBar, { TimelineSegment } from '../primitives/TimelineBar'
import RangeField from '../primitives/RangeField'
import MotionMeter from '../primitives/MotionMeter'
import { useTrimIdleWorker } from '../../hooks/useTrimIdleWorker'
import { EDL, consolidateKept, prettyDuration } from '../../lib/edl'
import { videoApi } from '../../lib/videoApi'
import { createToolPage } from '../../lib/toolRegistry'

const DEFAULT_ANALYSIS_FPS = 6
const DEFAULT_MIN_IDLE_MS = 450
const DEFAULT_THRESHOLD = 8

function TrimIdleContent() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [minIdleMs, setMinIdleMs] = useState<number>(DEFAULT_MIN_IDLE_MS)
  const [analysisFps, setAnalysisFps] = useState<number>(DEFAULT_ANALYSIS_FPS)
  const [currentTime, setCurrentTime] = useState(0)
  const [edl, setEdl] = useState<EDL | null>(null)
  const { analyze, analysis, progress, error } = useTrimIdleWorker()

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [file])

  useEffect(() => {
    if (!fileUrl) return
    const h = setTimeout(() => analyze(fileUrl, threshold, minIdleMs, analysisFps), 220)
    return () => clearTimeout(h)
  }, [fileUrl, threshold, minIdleMs, analysisFps, analyze])

  useEffect(() => {
    if (!analysis || !file) return
    const kept = consolidateKept(analysis.kept)
    const edl: EDL = { sourceName: file.name, duration: analysis.duration, kept, version: 'trimidle.v1' }
    setEdl(edl)
  }, [analysis, file])

  const totalKept = useMemo(() => {
    if (!edl) return 0
    return edl.kept.reduce((s, r) => s + (r.end - r.start), 0)
  }, [edl])

  function handleSeek(t: number) {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setCurrentTime(t)
  }

  function onTimeUpdate() {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
  }

  async function handleExportEdl() {
    if (!edl) return
    const blob = new Blob([JSON.stringify(edl, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = edl.sourceName.replace(/\.[^.]+$/, '') + '.trimidle.edl.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleRenderDownload() {
    if (!file || !edl) return
    const blob = await videoApi.renderEdl({ file, edl })
    const a = document.createElement('a')
    const base = file.name.replace(/\.[^.]+$/, '')
    a.href = URL.createObjectURL(blob)
    a.download = `${base}_trimidle.mp4`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const segments: TimelineSegment[] | undefined = edl?.kept.map(r => ({ start: r.start, end: r.end, keep: true }))

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div>
        <UploadPicker
          onSelectFile={setFile}
          onSelectDam={() => router.push('/dashboard/dam-explorer')}
          onSelectCamera={() => router.push('/dashboard/camera-monitor')}
        />

        {file && (
          <div className="mt-4">
            <video
              ref={videoRef}
              src={fileUrl ?? undefined}
              controls
              onTimeUpdate={onTimeUpdate}
              className="w-full rounded border border-zinc-700"
            />
            <div className="mt-3">
              {edl ? (
                <TimelineBar
                  duration={edl.duration}
                  segments={segments!}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              ) : (
                <div className="h-9 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                  {progress > 0 ? `Analyzing… ${(progress * 100).toFixed(0)}%` : 'Analyzing…'}
                </div>
              )}
              <div className="mt-2 text-xs flex items-center gap-3 text-zinc-400">
                <span><span className="inline-block w-3 h-3 bg-green-500 align-middle mr-1 rounded-sm" /> kept</span>
                <span><span className="inline-block w-3 h-3 bg-red-500 align-middle mr-1 rounded-sm" /> clipped</span>
                {edl && (
                  <span className="ml-auto">kept {prettyDuration(totalKept)} / {prettyDuration(edl.duration)}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded border border-zinc-700 p-3 space-y-3">
          <RangeField label="Threshold" value={threshold} min={1} max={40} step={1} onChange={setThreshold} unit="% px moving" />
          <RangeField label="Min idle" value={minIdleMs} min={0} max={2000} step={50} onChange={setMinIdleMs} unit="ms" />
          <RangeField label="Analysis FPS" value={analysisFps} min={2} max={12} step={1} onChange={setAnalysisFps} />
          {analysis && <MotionMeter samples={Array.from(analysis.motionPct)} className="text-green-400" />}
          <div className="text-xs text-zinc-400">
            Status
            <div className="mt-1 text-zinc-200">
              {error ? <span className="text-red-400">Error: {error}</span> : edl ? 'Ready' : 'Analyzing…'}
            </div>
          </div>
        </div>

        <div className="rounded border border-zinc-700 p-3">
          <div className="text-sm font-medium mb-2">Segments (EDL)</div>
          <div className="max-h-64 overflow-auto pr-1">
            {edl?.kept.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSeek(r.start)}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-zinc-800"
                title="Jump to segment start"
              >
                #{i + 1} &nbsp; {prettyDuration(r.start)} → {prettyDuration(r.end)} &nbsp; ({prettyDuration(r.end - r.start)})
              </button>
            )) || <div className="text-xs text-zinc-400">No segments yet…</div>}
          </div>
        </div>

        <div className="rounded border border-zinc-700 p-3 space-y-2">
          <button
            onClick={handleExportEdl}
            disabled={!edl}
            className="w-full px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
          >
            Save EDL (.json)
          </button>
          <button
            onClick={handleRenderDownload}
            disabled={!file || !edl}
            className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-40"
          >
            Render & Download MP4
          </button>
          <div className="text-[11px] text-zinc-400">
            Non-destructive: your original file is never modified. Rendering uses the EDL cut list.
          </div>
        </div>
      </aside>
    </div>
  )
}

export default createToolPage('Trim Idle', TrimIdleContent)
