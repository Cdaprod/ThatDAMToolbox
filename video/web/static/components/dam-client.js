// dam-client.js
const API_BASE = '/api/v1';

export async function textSearch(query, opts = {}) {
  const body = {
    query,
    level: opts.level || 'all',
    limit: opts.limit || 20,
    threshold: opts.threshold || 0.7
  };
  const res = await fetch(`${API_BASE}/dam/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listFolders() {
  const res = await fetch(`${API_BASE}/explorer/folders`);
  return res.json();
}

export async function listAssets(path) {
  const res = await fetch(`${API_BASE}/explorer/assets?path=${encodeURIComponent(path)}`);
  return res.json();
}