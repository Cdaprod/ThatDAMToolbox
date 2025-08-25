export type TimeRange = { start: number; end: number };  // seconds
export type EDL = { sourceName: string; duration: number; kept: TimeRange[]; version: string };

export function consolidateKept(ranges: TimeRange[], epsilon = 0.025): TimeRange[] {
  if (!ranges.length) return [];
  const out: TimeRange[] = [];
  let cur = { ...ranges[0] };
  for (let i = 1; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.start <= cur.end + epsilon) cur.end = Math.max(cur.end, r.end);
    else { out.push(cur); cur = { ...r }; }
  }
  out.push(cur);
  return out;
}

export function prettyDuration(s: number) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  const ms = Math.floor((s * 1000) % 1000).toString().padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}
