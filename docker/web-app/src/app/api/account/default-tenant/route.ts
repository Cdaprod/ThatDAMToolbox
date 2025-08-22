// Set preferred tenant for profile.
// Example:
//   curl -X PUT http://localhost:3000/api/account/default-tenant -d '{"defaultTenant":"demo"}'

import { NextRequest, NextResponse } from 'next/server';
import { setProfile } from '../../../../lib/server/settingsDB';

export async function PUT(req: NextRequest) {
  const { defaultTenant } = await req.json();
  if (!defaultTenant) return NextResponse.json({ error: 'defaultTenant required' }, { status: 400 });
  const p = setProfile({ defaultTenant });
  return NextResponse.json({ defaultTenant: p.defaultTenant });
}

