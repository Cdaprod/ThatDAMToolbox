/**
 * Central API client wrappers for dashboard views.
 * Replace with OpenAPI-generated clients via `yarn run generate-api`.
 *
 * Example usage:
 *   import { supervisor } from '@/lib/api';
 *   const nodes = await supervisor.listNodes();
 */
import { apiUrl } from '../networkConfig';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function getJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(
    apiUrl(path),
    { headers, next: { revalidate: 0 } } as any
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Supervisor / control-plane endpoints
export const supervisor = {
  listNodes: () => getJson<unknown[]>('/v1/nodes'),
  listPlans: () => getJson<unknown[]>('/v1/bootstrap'),
};

// Capture-daemon device management
export const captureDaemon = {
  listDevices: () => getJson<unknown[]>('/hwcapture/devices'),
};

// Video API: jobs and search
export const videoApi = {
  listJobs: () => getJson<unknown[]>('/video/jobs'),
  search: (q: string) =>
    getJson<unknown[]>(`/video/search?q=${encodeURIComponent(q)}`),
};

// API gateway: credentials, webhooks, billing
export const apiGateway = {
  credentials: () => getJson<unknown[]>('/credentials'),
  webhooks: () => getJson<unknown[]>('/webhooks'),
  billing: () => getJson<unknown[]>('/billing'),
};

// Observability helpers
export const observability = {
  health: (service: string) => getJson<unknown>(`/${service}/health`),
  metrics: (service: string) => getJson<unknown>(`/${service}/metrics`),
};

// Broker topics for events
export const brokerTopics = ['overlay.*', 'capture.*', 'video.*', 'webapp.*'] as const;
