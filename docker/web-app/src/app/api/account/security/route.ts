// Toggle MFA setting for the profile.
// Example:
//   curl -X PUT http://localhost:3000/api/account/security -d '{"mfaEnabled":true}'

import { NextRequest, NextResponse } from 'next/server';
import { setProfile } from '../../../../lib/server/settingsDB';

export async function PUT(req: NextRequest) {
  const { mfaEnabled } = await req.json();
  const p = setProfile({ mfaEnabled: !!mfaEnabled });
  return NextResponse.json({ mfaEnabled: p.mfaEnabled });
}

