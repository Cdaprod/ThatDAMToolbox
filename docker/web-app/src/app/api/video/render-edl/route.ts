import { NextRequest, NextResponse } from 'next/server'
import { apiBaseUrlServer } from '@/lib/networkConfig'

/**
 * POST /api/video/render-edl
 * Example:
 *   curl -F "file=@in.mp4" -F "edl=@edl.json" http://localhost:3000/api/video/render-edl -o out.mp4
 *
 * Stitches the kept ranges from an EDL into a new MP4. Currently echoes the
 * original file as a stub; replace with real video-api call.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const edlFile = form.get('edl') as File | null
  if (!file || !edlFile) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  const base = apiBaseUrlServer()
  const legacy = process.env.USE_LEGACY_VIDEO_API === '1'
  const upstream = await fetch(
    `${base}${legacy ? '/api/video/render-edl' : '/v1/render/edl'}`,
    { method: 'POST', body: form } as any
  )
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  })
}
