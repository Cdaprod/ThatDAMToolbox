import { NextRequest, NextResponse } from 'next/server'
import { apiBaseUrlServer } from '@/lib/networkConfig'

// Forward sequence render to media-api (Go) or legacy Python service
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'missing file' }, { status: 400 })
  const base = apiBaseUrlServer()
  const legacy = process.env.USE_LEGACY_VIDEO_API === '1'
  const upstream = await fetch(
    `${base}${legacy ? '/api/video/render-sequence' : '/v1/render/sequence'}`,
    { method: 'POST', body: form } as any
  )
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  })
}

