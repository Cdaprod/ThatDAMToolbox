// List members or create an invitation.
// Examples:
//   curl -s http://localhost:3000/api/tenants/demo/members
//   curl -X POST http://localhost:3000/api/tenants/demo/members -d '{"email":"user@example.com"}'

import { NextRequest, NextResponse } from 'next/server';
import {
  listMembers, createInvitation, listInvitations, ensureTenant
} from '../../../../../lib/server/settingsDB';

export async function GET(_: NextRequest, { params }: { params: { tenant: string } }) {
  ensureTenant(params.tenant);
  return NextResponse.json({ members: listMembers(params.tenant), invitations: listInvitations(params.tenant) });
}

export async function POST(req: NextRequest, { params }: { params: { tenant: string } }) {
  const { email, restrictToAllowedDomains, expiresInDays } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const inv = createInvitation(params.tenant, email, !!restrictToAllowedDomains, Number(expiresInDays || 7), 'system');
  return NextResponse.json({ invitation: inv });
}

