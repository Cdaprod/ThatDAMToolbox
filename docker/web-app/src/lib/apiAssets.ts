// video/lib/apiAssets.ts
import { apiUrl } from './networkConfig';

/* ------------------------------------------------------------------ *
 * 1.  Shared types                                                   *
 * ------------------------------------------------------------------ */
export type AssetKind = 'video' | 'image' | 'audio' | 'document';

export interface Asset {
  id: string;                        // UUID / sha1
  name: string;                      // display filename
  path: string;                      // full "virtual" path inside DAM
  kind: AssetKind;
  size: number;                      // bytes
  createdAt: string;                 // ISO-date
  updatedAt?: string;                // ISO-date
  tags: string[];
  // nested arbitrary metadata (ffprobe, exif, ML, …)
  meta: Record<string, unknown>;
}

export interface FolderNode {
  path: string;                      // e.g.  /Projects/Foo
  name: string;                      //       Foo
  children: FolderNode[];
  assetCount: number;
}

/* ------------------------------------------------------------------ *
 * 2.  Fetch helper                                                   *
 * ------------------------------------------------------------------ */
const API = apiUrl();

async function $<T = unknown>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    // Let caller catch – keeps helpers clean & tiny
    throw new Error(`${opts.method ?? 'GET'} ${url} → ${res.status}`);
  }
  // some DELETEs may return 204
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ *
 * 3.  Asset helpers                                                  *
 * ------------------------------------------------------------------ */
export interface NewAsset {
  filename:      string;
  device:        string;
  codec:         string;
  resolution:    string;
  fps:           number;
  duration:      number;
  timecodeStart: string;
  overlays: {
    focusPeaking: boolean;
    zebras:       boolean;
    falseColor:   boolean;
  };
  histogram:     number[];
  recordedAt:    string;
}

export const createAsset = (asset: NewAsset) =>
  fetch(`${API}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset),
  }).then(res => {
    if (!res.ok) throw new Error('Failed to create asset');
    return res.json();
  });

export const listAssets = () => $<Asset[]>(`${API}/assets`);

export const getAsset = (id: string) => $<Asset>(`${API}/assets/${id}`);

export const updateAsset = (
  id: string,
  data: { name?: string; metadata?: Record<string, unknown> }
) =>
  $<Asset>(`${API}/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const moveAssets = (
  assetIds: string[] | string,
  toPath: string,
) =>
  $<{ updated: Asset[] }>(`${API}/assets/move`, {
    method: 'PATCH',
    body: JSON.stringify({ assetIds: [].concat(assetIds as never), toPath }),
  });

export const deleteAssets = (assetIds: string[] | string) =>
  $<{ deleted: string[] }>(`${API}/assets`, {
    method: 'DELETE',
    body: JSON.stringify({ assetIds: [].concat(assetIds as never) }),
  });

/* single-asset convenience wrappers */
export const moveAsset = (id: string, toPath: string) =>
  moveAssets(id, toPath);

export const deleteAsset = (id: string) => deleteAssets(id);

/* ------------------------------------------------------------------ *
 * 4.  Folder helpers                                                 *
 * ------------------------------------------------------------------ */
export const listFolders = () => $<FolderNode[]>(`${API}/folders`);

export const createFolder = (path: string) =>
  $<FolderNode>(`${API}/folders`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });

export const deleteFolder = (path: string) =>
  $(`${API}/folders`, {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });