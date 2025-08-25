import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/account/set-default-tenant
 *
 * Example:
 *   curl -X POST -H "Content-Type: application/json" \
 *     -d '{"slug":"demo"}' http://localhost:3000/api/account/set-default-tenant
 *
 * Sets an httpOnly cookie `cda_tenant` so middleware can redirect quickly.
 */
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug required' }, { status: 400 })
    }
    const res = NextResponse.json({ ok: true, tenant: slug })
    res.cookies.set({
      name: 'cda_tenant',
      value: slug,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return res
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
}
