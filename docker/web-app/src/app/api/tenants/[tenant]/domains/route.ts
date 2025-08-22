// Manage tenant domain settings.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/domains

import { NextRequest, NextResponse } from 'next/server';
import { DomainsSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  return NextResponse.json({ domains: getTenantSettings(params.tenant).domains });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = DomainsSchema.safeParse(body.domains);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'domains', parsed.data, 'system');
  return NextResponse.json({ domains: updated.domains });
}

