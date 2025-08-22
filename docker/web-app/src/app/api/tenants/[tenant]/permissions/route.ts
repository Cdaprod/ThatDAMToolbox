// Manage tenant permissions model.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/permissions

import { NextRequest, NextResponse } from 'next/server';
import { PermissionsSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  return NextResponse.json({ permissions: getTenantSettings(params.tenant).permissions });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = PermissionsSchema.safeParse(body.permissions);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'permissions', parsed.data, 'system');
  return NextResponse.json({ permissions: updated.permissions });
}

