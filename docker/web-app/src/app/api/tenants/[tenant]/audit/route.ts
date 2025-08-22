// Read tenant audit log entries.
// Example:
//   curl -s http://localhost:3000/api/tenants/demo/audit

import { NextRequest, NextResponse } from 'next/server';
import { listAudit, ensureTenant } from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  ensureTenant(params.tenant);
  return NextResponse.json({ items: listAudit(params.tenant) });
}

