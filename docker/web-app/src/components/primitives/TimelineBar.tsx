'use client';

import { memo, useEffect, useMemo, useRef } from 'react';

export type TimelineSegment = { start: number; end: number; keep: boolean };

export default memo(function TimelineBar({
  duration,
  segments,
  currentTime,
  onSeek,
  height = 36,
  className = '',
  colorKeep = 'rgb(34 197 94)',  // green-500
  colorClip = 'rgb(239 68 68)',  // red-500
}: {
  duration: number;
  segments: TimelineSegment[];
  currentTime: number;
  onSeek: (t: number) => void;
  height?: number;
  className?: string;
  colorKeep?: string;
  colorClip?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const normalized = useMemo(() => {
    const out: TimelineSegment[] = [];
    if (!segments?.length || duration <= 0) return out;
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    let cur = { ...sorted[0] };
    const pushCur = () => cur.end > cur.start && out.push({ ...cur });

    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i];
      if (s.start <= cur.end) {
        if (s.keep === cur.keep) cur.end = Math.max(cur.end, s.end);
        else { pushCur(); cur = { ...s }; }
      } else {
        pushCur(); cur = { ...s };
      }
    }
    pushCur();

    const filled: TimelineSegment[] = [];
    let cursor = 0;
    for (const s of out) {
      if (s.start > cursor) filled.push({ start: cursor, end: s.start, keep: false });
      filled.push(s);
      cursor = s.end;
    }
    if (cursor < duration) filled.push({ start: cursor, end: duration, keep: false });
    return filled;
  }, [segments, duration]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.parentElement?.clientWidth ?? 800;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = colorClip;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = colorKeep;
    for (const s of normalized) {
      if (!s.keep) continue;
      const x = (s.start / duration) * width;
      const w = ((s.end - s.start) / duration) * width;
      ctx.fillRect(x, 0, w, height);
    }

    const sx = (currentTime / duration) * width;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(Math.max(0, Math.min(width - 2, sx - 1)), 0, 2, height);
  }, [duration, normalized, currentTime, height, colorKeep, colorClip]);

  function handleSeek(e: React.PointerEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(duration, t)));
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer rounded ${className}`}
      onPointerDown={handleSeek}
      onPointerMove={(e) => e.buttons === 1 && handleSeek(e)}
    />
  );
});
