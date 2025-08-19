/**
 * GET /api/assets/:id/download
 * Returns a presigned URL for downloading an asset directly from storage.
 * Example: curl http://localhost:3000/api/assets/123/download
 */
import { NextResponse } from 'next/server';
import { getPresignedGet } from '@/lib/minio';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const url = await getPresignedGet(params.id, { expiresSeconds: 3600 });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: 'failed to generate presigned URL' },
      { status: 500 },
    );
  }
}
