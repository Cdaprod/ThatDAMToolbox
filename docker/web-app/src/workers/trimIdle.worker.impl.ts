// Motion analysis implementation used by the Trim Idle tool
// Analyze frames for motion percentage and return kept ranges

export async function analyzeMotionURL(
  url: string,
  { thresholdPct, minIdleMs, fps }: { thresholdPct: number; minIdleMs: number; fps: number }
) {
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = 'anonymous';
  await new Promise(r => v.addEventListener('loadedmetadata', () => r(null), { once: true }));
  const dur = v.duration;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = Math.max(64, Math.min(256, v.videoWidth >> 2));
  canvas.height = Math.max(36, Math.min(144, v.videoHeight >> 2));
  const total = Math.max(1, Math.floor(dur * fps));
  const motion: number[] = [];
  let prev: ImageData | null = null;
  for (let i = 0; i <= total; i++) {
    const t = i / fps;
    v.currentTime = Math.min(dur, t);
    await new Promise(r => v.addEventListener('seeked', () => r(null), { once: true }));
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const cur = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (prev) {
      let changed = 0;
      for (let p = 0; p < cur.data.length; p += 4) {
        const y1 = 0.2126 * prev.data[p] + 0.7152 * prev.data[p + 1] + 0.0722 * prev.data[p + 2];
        const y2 = 0.2126 * cur.data[p] + 0.7152 * cur.data[p + 1] + 0.0722 * cur.data[p + 2];
        if (Math.abs(y2 - y1) > 6.5) changed++;
      }
      const pct = (changed / (cur.data.length / 4)) * 100;
      motion.push(pct);
    } else {
      motion.push(100);
    }
    prev = cur;
    await new Promise(r => setTimeout(r, 0));
  }

  const kept: { start: number; end: number }[] = [];
  let run: number | null = null;
  for (let i = 0; i < motion.length; i++) {
    const t = i / fps;
    const nonIdle = motion[i] > thresholdPct;
    if (nonIdle && run === null) run = t;
    if ((!nonIdle || i === motion.length - 1) && run !== null) {
      const end = nonIdle && i === motion.length - 1 ? t : t;
      if ((end - run) * 1000 >= Math.max(1, minIdleMs)) kept.push({ start: run, end });
      run = null;
    }
  }
  kept.sort((a, b) => a.start - b.start);
  const merged: typeof kept = [];
  for (const k of kept) {
    const last = merged[merged.length - 1];
    if (last && k.start - last.end < 0.025) last.end = Math.max(last.end, k.end);
    else merged.push({ ...k });
  }
  return { duration: dur, kept: merged };
}

