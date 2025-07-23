export interface Asset /* same interface you showed */ { … }
export interface FolderNode { … }

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ASSETS -------------------------------------------------------------- */
export async function listAssets() {
  const r = await fetch(`${API}/assets`);
  if (!r.ok) throw new Error('Failed to fetch assets');
  return (await r.json()) as Asset[];
}

export async function moveAssets(assetIds: string[], toPath: string) {
  const r = await fetch(`${API}/assets/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds, toPath }),
  });
  if (!r.ok) throw new Error('Move failed');
  return (await r.json()) as { updated: Asset[] };
}

export async function deleteAssets(assetIds: string[]) {
  const r = await fetch(`${API}/assets`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds }),
  });
  if (!r.ok) throw new Error('Delete failed');
  return { deleted: assetIds };
}

/* FOLDERS ------------------------------------------------------------- */
export async function listFolders() {
  const r = await fetch(`${API}/folders`);
  if (!r.ok) throw new Error('Failed to fetch folders');
  return (await r.json()) as FolderNode[];
}