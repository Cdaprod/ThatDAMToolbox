// Get or update user profile.
// Example:
//   curl -s http://localhost:3000/api/account/profile

import { NextRequest, NextResponse } from 'next/server';
import { getProfile, setProfile } from '../../../../lib/server/settingsDB';

export async function GET() {
  return NextResponse.json(getProfile());
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(setProfile(body));
}

