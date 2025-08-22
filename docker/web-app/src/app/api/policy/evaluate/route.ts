// Evaluate SSO policy for an email.
// Example:
//   curl -X POST http://localhost:3000/api/policy/evaluate -d '{"tenant":"demo","email":"a@b.com"}'

import { NextRequest, NextResponse } from 'next/server';
import { getTenantSettings, pushAudit } from '../../../../lib/server/settingsDB';

function isGoogleEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return domain === 'gmail.com' || domain === 'googlemail.com' || domain.endsWith('.google.com');
}

export async function POST(req: NextRequest) {
  const { tenant, email } = await req.json();
  if (!tenant || !email) return NextResponse.json({ error: 'tenant and email required' }, { status: 400 });
  const t = getTenantSettings(tenant);
  let allowed = true;

  if (t.sso.enabled) {
    const domain = email.split('@')[1]?.toLowerCase();
    const allowedDomains = (t.sso.allowedDomains || []).map((d) => d.toLowerCase());
    if (allowedDomains.length && domain && !allowedDomains.includes(domain)) allowed = false;
    if (t.sso.enforceGoogleOnly && !isGoogleEmail(email)) allowed = false;
  }

  pushAudit(tenant, {
    kind: 'policy-eval',
    actor: 'system',
    target: `email:${email}`,
    summary: `Evaluated SSO policy: ${allowed ? 'allow' : 'deny'}`,
  });

  return NextResponse.json({ allowed });
}

