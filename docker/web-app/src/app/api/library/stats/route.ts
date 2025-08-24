/**
 * GET /api/library/stats
 * Returns library statistics.
 * Attempts to source from the media-api service when
 * `MEDIA_API_BASE_URL` is defined, otherwise falls back to stub data.
 * Example: curl http://localhost:3000/api/library/stats
*/
import { NextResponse } from 'next/server';

export async function GET(_req: Request) {
  const base = process.env.MEDIA_API_BASE_URL;
  if (base) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/v1/assets?page_size=10`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          assets: data.total ?? 0,
          batches: 0,
          lastIngest: null,
          source: 'media-api',
          assetsList: data.items ?? [],
        });
      }
    } catch (_err) {
      // ignore and fall through to stub data
    }
  }

  return NextResponse.json({
    assets: 0,
    batches: 0,
    lastIngest: null,
    source: 'stub',
    assetsList: [],
  });
}
