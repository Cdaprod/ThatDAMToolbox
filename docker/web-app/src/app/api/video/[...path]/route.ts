// src/app/api/video/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrlServer } from '@/lib/networkConfig';

export const runtime  = 'nodejs';        // we need full Node APIs (stream → stream)
export const dynamic  = 'force-dynamic';

const API_ORIGIN = apiBaseUrlServer();
const LEGACY = process.env.USE_LEGACY_VIDEO_API === '1';

/** Strip hop-by-hop headers that mustn’t be forwarded */
const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function cleanHeaders(source: Headers) {
  const target = new Headers();
  source.forEach((v, k) => {
    if (!hopByHop.has(k.toLowerCase())) target.append(k, v);
  });
  return target;
}

/** Generic proxy – re-exported for every verb */
async function proxy(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const prefix = LEGACY ? '/api/video/' : '/v1/';
  const url = `${API_ORIGIN}${prefix}${params.path.join('/')}`;
  const init: RequestInit = {
    method: req.method,
    headers: cleanHeaders(req.headers),
    // GET & HEAD must have null body
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    duplex: 'half', // keep the stream open for large uploads
  };

  const upstream = await fetch(url, init);
  const respHeaders = cleanHeaders(upstream.headers);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

// Export the same handler for every verb we want to support
export const GET     = proxy;
export const POST    = proxy;
export const PUT     = proxy;
export const PATCH   = proxy;
export const DELETE  = proxy;
export const HEAD    = proxy;
export const OPTIONS = proxy;
