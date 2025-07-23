// app/api/video/[...path]/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';          // enable streaming body
export const dynamic = 'force-dynamic';   // disable ISR / cache

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  const dest = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080'}/api/video/${params.path.join('/')}`;
  const res = await fetch(dest, { method: 'POST', body: req.body, headers: req.headers });
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}