// Simple JSON fetch helper for client and server components.
// Example:
//   const data = await api<MyType>("/api/example");

let PAT: string | null = null;

async function ensurePat() {
  if (PAT) return PAT;
  const r = await fetch('/auth/session/exchange', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-User-ID': 'dev-user' },
  });
  if (!r.ok) throw new Error('exchange_failed');
  const { access_token } = await r.json();
  PAT = access_token;
  return PAT;
}

export async function api<T>(
  path: string,
  opts?: RequestInit & { json?: any },
): Promise<T> {
  const { json, headers, ...rest } = opts || {};
  const token = await ensurePat();
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(headers || {}),
    },
    credentials: 'include',
    body: json ? JSON.stringify(json) : (rest.body as BodyInit | null | undefined),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

