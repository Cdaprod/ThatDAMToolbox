// src/app/api/video/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime  = 'nodejs';        // we need full Node APIs (stream → stream)
export const dynamic  = 'force-dynamic';

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

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
  const url = `${API_ORIGIN}/api/video/${params.path.join('/')}`;
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