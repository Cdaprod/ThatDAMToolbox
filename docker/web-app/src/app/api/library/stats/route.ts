/**
 * GET /api/library/stats
 * Returns placeholder library statistics for development.
 * Example: curl http://localhost:3000/api/library/stats
 */
import { NextResponse } from 'next/server';

export async function GET(_req: Request) {
  try {
    return NextResponse.json({
      assets: 0,
      batches: 0,
      lastIngest: null,
      source: 'stub',
      assetsList: [],
    });
  } catch (_err) {
    return NextResponse.json(
      { error: 'failed to load stats' },
      { status: 500 },
    );
  }
}
