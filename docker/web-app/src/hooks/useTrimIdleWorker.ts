'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Analysis = { duration: number; step: number; motionPct: Float32Array; kept: { start:number; end:number }[] };

export function useTrimIdleWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('../workers/trimIdle.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<any>) => {
      if (e.data?.progress != null) setProgress(e.data.progress);
      else if (e.data?.ok) { setAnalysis({ duration: e.data.duration, step: e.data.step, motionPct: e.data.motionPct, kept: e.data.kept }); setError(null); }
      else setError(e.data?.error ?? 'Unknown error');
    };
    workerRef.current = w;
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  const analyze = useMemo(() => (url: string, thresholdPct: number, minIdleMs: number, analysisFps: number) => {
    setProgress(0); setAnalysis(null); setError(null);
    workerRef.current?.postMessage({ url, thresholdPct, minIdleMs, analysisFps });
  }, []);

  return { analyze, analysis, progress, error };
}
