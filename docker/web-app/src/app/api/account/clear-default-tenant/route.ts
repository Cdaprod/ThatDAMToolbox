import { NextResponse } from 'next/server'

/**
 * POST /api/account/clear-default-tenant
 *
 * Example:
 *   curl -X POST http://localhost:3000/api/account/clear-default-tenant
 *
 * Removes the `cda_tenant` cookie set for tenant-first redirects.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: 'cda_tenant',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
