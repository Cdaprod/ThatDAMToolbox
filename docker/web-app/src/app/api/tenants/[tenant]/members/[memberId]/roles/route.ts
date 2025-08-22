// Update roles for a tenant member.
// Example:
//   curl -X PUT http://localhost:3000/api/tenants/demo/members/u_1/roles -d '{"roles":["admin"]}'

import { NextRequest, NextResponse } from 'next/server';
import { updateMemberRoles } from '../../../../../../../lib/server/settingsDB';

export async function PUT(req: NextRequest, { params }: { params: { tenant: string; memberId: string } }) {
  const { roles } = await req.json();
  if (!Array.isArray(roles)) return NextResponse.json({ error: 'roles must be array' }, { status: 400 });
  const updated = updateMemberRoles(params.tenant, params.memberId, roles, 'system');
  if (!updated) return NextResponse.json({ error: 'member not found' }, { status: 404 });
  return NextResponse.json({ member: updated });
}

