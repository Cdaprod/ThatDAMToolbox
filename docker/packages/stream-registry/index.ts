/**
 * Query the api-gateway stream registry and pick a transport.
 *
 * Example:
 * ```ts
 * const reg = await fetchRegistry();
 * const transport = selectTransport(reg[0], 'director');
 * ```
 */
export interface StreamEntry {
  id: string;
  webrtc?: string;
  hls?: string;
}

export type ViewMode = 'director' | 'focus-pull';

/**
 * fetchRegistry retrieves the list of stream entries from the api-gateway.
 *
 * Example:
 * ```ts
 * const streams = await fetchRegistry();
 * ```
 */
export async function fetchRegistry(baseUrl = ''): Promise<StreamEntry[]> {
  const res = await fetch(`${baseUrl}/api/streams`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`stream registry error: ${res.status}`);
  }
  return res.json();
}

/**
 * selectTransport chooses an appropriate transport based on the mode.
 * director prioritises HLS while focus-pull prefers WebRTC.
 *
 * Example:
 * ```ts
 * const url = selectTransport(entry, 'focus-pull');
 * ```
 */
export function selectTransport(entry: StreamEntry, mode: ViewMode): string | undefined {
  if (mode === 'focus-pull') return entry.webrtc || entry.hls;
  return entry.hls || entry.webrtc;
}
