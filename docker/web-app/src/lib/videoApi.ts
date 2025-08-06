// lib/videoApi.ts
import { apiUrl } from './networkConfig'
import type { Asset } from './apiAssets'

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

/* ---------- REST routes your React code needs ---------- */
export const videoApi = {
  /* health check -- already used in /app/page.tsx */
  health: () => getJson<{ status: string; version: string }>('/health'),

  /* DAM / batch explorer */
  listBatches: () => getJson<Batch[]>('/batches'),
  inspectBatch: (id: string) => getJson<BatchCard>('/batches/' + id + '/cards'),

  /* motion-analysis or other custom calls */
  motionExtract: (payload: MotionExtractPayload) =>
    postJson<MotionJob>('/motion/extract', payload),

  /* hardware capture helpers */
  listDevices: () => getJson<Device[]>('/hwcapture/devices'),
  witnessStart: (req: WitnessReq) => postJson<{}>('/hwcapture/witness_record', req),
  vectorSearch: (q: string) => getJson<Asset[]>(`/vector-search?q=${encodeURIComponent(q)}`),
};

/* ---------- (very) skinny DTOs ---------- */
export interface Batch   { id: string; batch?: string; count: number }
export interface BatchCard { items: VideoCard[] }
export interface VideoCard { artifact: { path: string }; /* …snip… */ }
export interface MotionExtractPayload { path: string; sensitivity?: number }
export interface MotionJob { job_id: string; status: string }
export interface Device { path: string; width: number; height: number; fps: number }
export interface WitnessReq { device: string; output: string }