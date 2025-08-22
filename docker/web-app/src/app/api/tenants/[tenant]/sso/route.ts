// Manage tenant SSO policy.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/sso

import { NextRequest, NextResponse } from 'next/server';
import { SSOSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  return NextResponse.json({ sso: getTenantSettings(params.tenant).sso });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = SSOSchema.safeParse(body.sso);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'sso', parsed.data, 'system');
  return NextResponse.json({ sso: updated.sso });
}

