// Manage tenant capture defaults.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/capture-defaults

import { NextRequest, NextResponse } from 'next/server';
import { CaptureDefaultsSchema } from '../../../../../lib/schemas/tenantSettings';
import { getTenantSettings, setTenantSettings } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  return NextResponse.json({ capture: getTenantSettings(params.tenant).capture });
}

export async function PUT(req: NextRequest, { params }: { params: { tenant: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = CaptureDefaultsSchema.safeParse(body.capture);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = setTenantSettings(params.tenant, 'capture', parsed.data, 'system');
  return NextResponse.json({ capture: updated.capture });
}

