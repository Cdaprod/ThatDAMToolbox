/**
 * POST /api/contact
 *
 * Receives contact form submissions and forwards them via email.
 * Example:
 *   curl -X POST http://localhost:3000/api/contact \
 *     -H 'Content-Type: application/json' \
 *     -d '{"name":"A","email":"a@b.com","message":"hi"}'
 */
import { NextResponse } from 'next/server'
// @ts-ignore - sendMail is plain JS
import { sendMail } from '@/lib/sendMail'

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json()
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await sendMail({ name, email, message })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('contact error', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
