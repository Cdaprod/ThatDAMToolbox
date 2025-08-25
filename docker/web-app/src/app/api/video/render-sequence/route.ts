import { NextRequest, NextResponse } from 'next/server'

// Stub endpoint: echoes original file for offline development
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'missing file' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  return new NextResponse(buf, { headers: { 'Content-Type': 'video/mp4' } })
}

