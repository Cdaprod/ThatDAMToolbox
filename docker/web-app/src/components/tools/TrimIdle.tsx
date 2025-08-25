'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import UploadPicker from '../primitives/UploadPicker';
import TimelineBar from '../primitives/TimelineBar';
import RangeField from '../primitives/RangeField';
import ToolShell from '../primitives/ToolShell';
import { Services } from '../../lib/services/serviceRegistry';
import { edlToSequence } from '../../lib/media/edl';
import type { SimpleEDL } from '../../lib/media/types';
import { prettyDuration } from '../../lib/edl';
import { createToolPage } from '../../lib/toolRegistry';
import { useEdlPlayback } from '../../hooks/useEdlPlayback';

const DEFAULT_ANALYSIS_FPS = 6;
const DEFAULT_MIN_IDLE_MS = 450;
const DEFAULT_THRESHOLD = 8;

type AnalysisResult = {
  duration: number;
  kept: { start: number; end: number }[];
};

function TrimIdleContent() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Controls
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [minIdleMs, setMinIdleMs] = useState<number>(DEFAULT_MIN_IDLE_MS);
  const [analysisFps, setAnalysisFps] = useState<number>(DEFAULT_ANALYSIS_FPS);

  // UI state
  const [currentTime, setCurrentTime] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Object URL lifecycle
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Debounced (re)analysis via Services (local worker or remote), non-blocking
  useEffect(() => {
    if (!fileUrl) return;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const res: AnalysisResult = await Services.analyzeMotion(fileUrl, {
          thresholdPct: threshold,
          minIdleMs,
          fps: analysisFps,
        });
        setAnalysis(res);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? String(e));
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(h);
  }, [fileUrl, threshold, minIdleMs, analysisFps]);

  // Build EDL from analysis
  const edl: SimpleEDL | null = useMemo(() => {
    if (!analysis || !file) return null;
    return {
      version: 'trimidle.v1',
      sourceName: file.name,
      duration: analysis.duration,
      kept: analysis.kept,
    };
  }, [analysis, file]);

  // EDL-aware playback (skip clipped spans during play)
  useEdlPlayback(videoRef.current, edl?.kept ?? null);

  const totalKept = useMemo(() => {
    if (!edl) return 0;
    return edl.kept.reduce((s, r) => s + (r.end - r.start), 0);
  }, [edl]);

  function handleSeek(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
  }

  async function handleRenderDownload() {
    if (!file || !edl) return;
    const seq = edlToSequence(edl, /* assetId */ 'local-upload');
    const blob = await Services.renderSequence(file, seq);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = file.name.replace(/\.[^.]+$/, '');
    a.download = `${base}_trimidle.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <ToolShell
      title="Trim Idle"
      subtitle="Detect low-motion spans, preview only the kept parts, and export non-destructively."
    >
      <div>
        <UploadPicker
          onSelectFile={setFile}
          onSelectDam={() => location.assign('/dashboard/dam-explorer')}
          onSelectCamera={() => location.assign('/dashboard/camera-monitor')}
        />

        {file && (
          <div className="mt-4">
            <video
              ref={videoRef}
              src={fileUrl ?? undefined}
              controls
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              className="w-full rounded border border-zinc-700"
            />
            <div className="mt-3">
              {edl ? (
                <TimelineBar
                  duration={edl.duration}
                  segments={edl.kept.map(k => ({ start: k.start, end: k.end, keep: true }))}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              ) : (
                <div className="h-9 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                  {loading ? 'Analyzing…' : (error ? 'Waiting for video…' : 'Analyzing…')}
                </div>
              )}
              <div className="mt-2 text-xs flex items-center gap-3 text-zinc-400">
                <span><span className="inline-block w-3 h-3 bg-green-500 align-middle mr-1 rounded-sm" /> kept</span>
                <span><span className="inline-block w-3 h-3 bg-red-500 align-middle mr-1 rounded-sm" /> clipped</span>
                {edl && (
                  <span className="ml-auto">
                    kept {prettyDuration(totalKept)} / {prettyDuration(edl.duration)}
                  </span>
                )}
              </div>
              {error && <div className="mt-2 text-xs text-red-400">Error: {error}</div>}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded border border-zinc-700 p-3">
          <div className="text-sm font-medium mb-2">Analysis</div>
          <div className="space-y-3">
            <RangeField
              label="Idle Threshold"
              value={threshold}
              min={1}
              max={40}
              step={1}
              onChange={setThreshold}
              unit="% px moving"
            />
            <RangeField
              label="Min Idle (ms)"
              value={minIdleMs}
              min={0}
              max={2000}
              step={50}
              onChange={setMinIdleMs}
            />
            <RangeField
              label="Analysis FPS"
              value={analysisFps}
              min={2}
              max={12}
              step={1}
              onChange={setAnalysisFps}
            />
            <div className="text-xs text-zinc-400">
              {error ? <span className="text-red-400">Error: {String(error)}</span> : (edl ? 'Ready' : 'Analyzing…')}
            </div>
          </div>
        </div>

        <div className="rounded border border-zinc-700 p-3 space-y-2">
          <button
            onClick={handleRenderDownload}
            disabled={!file || !edl}
            className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-40"
          >
            Render & Download MP4
          </button>
          <div className="text-[11px] text-zinc-400">
            Non-destructive: original file remains unchanged. Rendering uses the EDL cut list.
          </div>
        </div>
      </aside>
    </ToolShell>
  );
}

export default createToolPage('Trim Idle', TrimIdleContent);
