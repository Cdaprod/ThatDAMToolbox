// Runs in a Web Worker. No DOM; OffscreenCanvas when available.
// Input: file blob URL, threshold [0..100], minIdleMs, analysisFps
// Output: motion mask array + suggested kept ranges (EDL)

export type AnalyzeRequest = {
  url: string;
  thresholdPct: number;   // "how much motion counts" – lower = stricter idle detection
  minIdleMs: number;      // ignore short idle blips under this duration
  analysisFps: number;    // subsample rate for speed
};

export type AnalyzeResponse = {
  ok: true;
  duration: number;
  step: number;           // seconds per sample
  motionPct: Float32Array;
  kept: { start: number; end: number }[];
} | { ok: false; error: string };

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  try {
    const { url, thresholdPct, minIdleMs, analysisFps } = e.data;

    const video = await loadVideo(url);
    const duration = video.duration;
    const step = 1 / analysisFps;
    const samples = Math.max(1, Math.floor(duration / step));

    const { canvas, ctx, w, h, prev } = makeCanvas(video.videoWidth, video.videoHeight);

    const motionPct = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const t = Math.min(duration, i * step);
      video.currentTime = t;
      await waitSeek(video);

      ctx.drawImage(video, 0, 0, w, h);
      const cur = ctx.getImageData(0, 0, w, h).data;

      // simple luminance diff
      let diffCount = 0;
      for (let p = 0; p < cur.length; p += 4) {
        const y1 = (0.2126 * prev[p] + 0.7152 * prev[p + 1] + 0.0722 * prev[p + 2]);
        const y2 = (0.2126 * cur[p]  + 0.7152 * cur[p + 1]  + 0.0722 * cur[p + 2]);
        if (Math.abs(y2 - y1) > 6.5) diffCount++; // ~small luminance threshold
        prev[p] = cur[p]; prev[p + 1] = cur[p + 1]; prev[p + 2] = cur[p + 2];
      }
      motionPct[i] = (diffCount / (cur.length / 4)) * 100.0;
      if (i % 8 === 0) self.postMessage({ progress: i / samples }); // optional progress events
    }

    const idleMax = thresholdPct; // treat <= as idle
    const minIdleSamples = Math.max(1, Math.floor((minIdleMs / 1000) / step));

    // Build kept ranges where motion > idleMax
    const keptRanges: { start: number; end: number }[] = [];
    let inKeep = false;
    let keepStart = 0;

    // We'll treat runs of "idle" as gaps; compress short idle gaps below minIdleMs.
    let idleRun = 0;
    for (let i = 0; i < samples; i++) {
      const isIdle = motionPct[i] <= idleMax;
      if (isIdle) {
        idleRun++;
      } else {
        // motion frame
        if (!inKeep) { inKeep = true; keepStart = i * step; }
        if (idleRun > 0 && idleRun >= minIdleSamples) {
          // idle run long enough to cut: close previous keep
          const keepEnd = i * step - idleRun * step;
          if (inKeep && keepEnd > keepStart) keptRanges.push({ start: keepStart, end: keepEnd });
          inKeep = false;
        }
        idleRun = 0;
      }
    }
    // close tail
    if (inKeep) keptRanges.push({ start: keepStart, end: duration });

    (video as any).src = ''; // release

    self.postMessage({
      ok: true,
      duration,
      step,
      motionPct,
      kept: keptRanges,
    } as AnalyzeResponse);
  } catch (err: any) {
    self.postMessage({ ok: false, error: err?.message ?? String(err) } as AnalyzeResponse);
  }
};

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = self.document?.createElement('video') ?? new (self as any).HTMLVideoElement();
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.addEventListener('loadedmetadata', () => res(v), { once: true });
    v.addEventListener('error', () => rej(new Error('Failed to load video')), { once: true });
    v.src = url;
  });
}

function waitSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
  });
}

function makeCanvas(w: number, h: number) {
  const scale = 0.25; // downscale for speed
  const cw = Math.max(64, Math.floor(w * scale));
  const ch = Math.max(64, Math.floor(h * scale));
  // @ts-ignore
  const canvas: HTMLCanvasElement = self.document?.createElement('canvas') ?? new (self as any).OffscreenCanvas(cw, ch);
  // @ts-ignore
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  // @ts-ignore
  canvas.width = cw; canvas.height = ch;
  // prior frame
  const prev = new Uint8ClampedArray(cw * ch * 4);
  return { canvas, ctx, w: cw, h: ch, prev };
}
