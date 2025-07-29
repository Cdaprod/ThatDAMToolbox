// /docker/web-app/src/lib/video.ts

import { apiUrl } from './networkConfig';   // <<-- ADD THIS

// Base URL for FastAPI backend (runtime resolved, robust to host mode, LAN, etc)
const API_BASE = apiUrl();    // <<-- CHANGE THIS

// Standard GET request helper
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Standard POST request helper
async function post<T>(path: string, data: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── API Functions ─────────────────────────────────────────────

// Launch a scan job (remains POST, if required by FastAPI)
export function scan(root: string, workers = 4) {
  return post<{ scanned: number }>('/scan', { root, workers });
}

// Get library statistics (GET /stats)
export function stats() {
  // Adjust the type keys if your /stats returns different ones!
  return get<{ files: number; batches: number; duration_sec: number; total_bytes: number }>('/stats');
}

// Get recent file list (GET /recent?limit=N)
export function recent(limit = 10) {
  return get<{ path: string; modified: string }[]>(`/recent?limit=${limit}`);
}

// You can add more endpoints following this pattern