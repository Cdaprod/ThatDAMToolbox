// Frontend policy helper for capability checks
// Example:
//   const allowed = await can('media.render');

export type Action = 'media.render' | 'media.analyze' | 'media.read';

export async function can(action: Action): Promise<boolean> {
  try {
    const res = await fetch('/api/policy/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!data?.allow;
  } catch {
    return false;
  }
}

