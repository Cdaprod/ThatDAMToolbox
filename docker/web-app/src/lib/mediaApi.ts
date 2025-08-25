// lib/mediaApi.ts
import { apiUrl } from './networkConfig'
import type { Asset } from './apiAssets'
import type { EDL } from './edl'

/* ---------- helpers ---------- */
async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), { next: { revalidate: 0 }, ...init } as any);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return getJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
}

async function postForm(path: string, form: FormData, init?: RequestInit): Promise<Blob> {
  const res = await fetch(apiUrl(path), { method: 'POST', body: form, ...init } as any);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.blob();
}

/* ---------- REST routes your React code needs ---------- */
export const mediaApi = {
  /* health check -- already used in /app/page.tsx */
  health: () => getJson<{ status: string; version: string }>('/health'),

  /* DAM / batch explorer */
  listBatches: () => getJson<Batch[]>('/v1/batches'),
  inspectBatch: (id: string) => getJson<BatchCard>(`/v1/batches/${id}/cards`),

  /* motion-analysis or other custom calls */
  motionExtract: (payload: MotionExtractPayload) =>
    postJson<MotionJob>('/v1/motion/extract', payload),

  /* trim idle frames */
  trimIdle: (payload: TrimIdlePayload) => {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.method) form.append('method', payload.method);
    if (payload.noise !== undefined) form.append('noise', String(payload.noise));
    if (payload.freeze_dur !== undefined) form.append('freeze_dur', String(payload.freeze_dur));
    if (payload.pix_thresh !== undefined) form.append('pix_thresh', String(payload.pix_thresh));
    return postForm('/v1/trim_idle', form);
  },

  /* render kept ranges to a new mp4 */
  renderEdl: ({ file, edl }: { file: File; edl: EDL }): Promise<Blob> => {
    const form = new FormData();
    form.append('file', file);
    form.append('edl', new Blob([JSON.stringify(edl)], { type: 'application/json' }), 'edl.json');
    return fetch('/api/video/render-edl', { method: 'POST', body: form }).then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.blob();
    });
  },

  /* ffmpeg console */
  ffmpegRun: (payload: { command: string; output?: string }) =>
    postJson<{ output: string }>('/v1/ffmpeg/run', payload),

  /* hardware capture helpers */
  listDevices: () => getJson<Device[]>('/v1/hwcapture/devices'),
  witnessStart: (req: WitnessReq) =>
    postJson<{ job: string; status: string }>('/v1/hwcapture/witness_record', req),
  vectorSearch: (q: string) =>
    getJson<Asset[]>(`/v1/vector-search?q=${encodeURIComponent(q)}`),
};

/* ---------- (very) skinny DTOs ---------- */
export interface Batch   { id: string; batch?: string; count: number }
export interface BatchCard { items: VideoCard[] }
export interface VideoCard { artifact: { path: string }; /* …snip… */ }
export interface MotionExtractPayload { path: string; sensitivity?: number }
export interface MotionJob { job_id: string; status: string }
export interface Device { path: string; width: number; height: number; fps: number }
export interface WitnessReq { main: string; witness: string; duration?: number }
export interface TrimIdlePayload {
  file: File;
  method?: string;
  noise?: number;
  freeze_dur?: number;
  pix_thresh?: number;
}