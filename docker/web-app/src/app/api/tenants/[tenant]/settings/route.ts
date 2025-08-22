// GET/PUT tenant branding settings.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/settings

import { NextRequest, NextResponse } from 'next/server';
import { BrandingSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  const data = getTenantSettings(params.tenant);
  return NextResponse.json({ branding: data.branding });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = BrandingSchema.safeParse(body.branding);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'branding', parsed.data, 'system');
  return NextResponse.json({ branding: updated.branding });
}

