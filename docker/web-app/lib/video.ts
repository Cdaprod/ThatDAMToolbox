// lib/video.ts
const VIDEO_BASE = '/api/video';

async function post<T>(path: string, data: any): Promise<T> {
  const res = await fetch(`${VIDEO_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// now your "SDK" functions
export function scan(root: string, workers = 4) {
  return post<{ scanned: number }>('scan', { action: 'scan', root, workers });
}

export function stats() {
  return post<{ totalFiles: number; totalSize: number }>('stats', { action: 'stats' });
}

export function recent(limit = 10) {
  return post<{ path: string; modified: string }[]>('recent', { action: 'recent', limit });
}