import { NextRequest, NextResponse } from 'next/server'

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

  // In a real deployment, forward both file and edl to your video-api service.
  // const resp = await fetch('http://video-api:8080/trimidle/render-edl', { method: 'POST', body: form })
  // return new NextResponse(resp.body, { headers: resp.headers })

  const buf = Buffer.from(await file.arrayBuffer())
  return new NextResponse(buf, { headers: { 'Content-Type': 'video/mp4' } })
}
