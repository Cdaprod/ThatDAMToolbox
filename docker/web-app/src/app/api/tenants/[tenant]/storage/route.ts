// Manage tenant storage backend settings.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/storage

import { NextRequest, NextResponse } from 'next/server';
import { StorageSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  return NextResponse.json({ storage: getTenantSettings(params.tenant).storage });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = StorageSchema.safeParse(body.storage);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'storage', parsed.data, 'system');
  return NextResponse.json({ storage: updated.storage });
}

