// Manage connected identities.
// Example:
//   curl -X PUT http://localhost:3000/api/account/identities -d '{"action":"disconnect-google"}'

import { NextRequest, NextResponse } from 'next/server';
import { setProfile } from '../../../../lib/server/settingsDB';

export async function PUT(req: NextRequest) {
  const { action } = await req.json();
  if (action === 'disconnect-google') {
    const p = setProfile({ googleConnected: false });
    return NextResponse.json({ googleConnected: p.googleConnected });
  }
  return NextResponse.json({ error: 'unsupported action' }, { status: 400 });
}

