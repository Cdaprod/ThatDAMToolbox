// Simple JSON fetch helper for client and server components.
// Example:
//   const data = await api<MyType>("/api/example", { method: "POST", json: { id: 1 } });

export async function api<T>(
  path: string,
  opts?: RequestInit & { json?: any },
): Promise<T> {
  const { json, headers, ...rest } = opts || {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: json ? JSON.stringify(json) : (rest.body as BodyInit | null | undefined),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

