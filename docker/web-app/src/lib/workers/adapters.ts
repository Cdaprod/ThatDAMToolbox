// Adapter to invoke the in-browser motion analyzer
export async function analyzeMotionURL(url: string, opts: { thresholdPct: number; minIdleMs: number; fps: number }) {
  const { analyzeMotionURL: impl } = await import('../../workers/trimIdle.worker.impl');
  return impl(url, opts);
}

