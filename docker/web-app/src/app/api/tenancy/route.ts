/**
 * POST /api/tenancy
 * Forwards tenant creation requests to the Tenancy service.
 * Example:
 * curl -X POST http://localhost:3000/api/tenancy \\
 *   -H 'Content-Type: application/json' \\
 *   -d '{"name":"Demo","email":"demo@example.com"}'
 */
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const url = process.env.TENANCY_URL;
  if (!url) {
    return NextResponse.json(
      { error: 'TENANCY_URL not configured' },
      { status: 500 },
    );
  }

  try {
    const payload = await req.json();
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      let message = upstream.statusText;
      try {
        const err = await upstream.json();
        message = err.error || message;
      } catch {
        // use statusText
      }
      return NextResponse.json(
        { error: `Tenancy service error: ${message}` },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json({ tenantId: data.tenantId, token: data.token });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to contact tenancy service' },
      { status: 502 },
    );
  }
}
