// /docker/web-app/src/app/page.tsx

import { redirect } from 'next/navigation';
import { api } from '../lib/api/client';

/**
 * Root page that redirects to the user's default tenant dashboard
 * or to the login screen when unauthenticated.
 *
 * Example:
 *   visiting "/" -> "/acme/dashboard"
 */
export default async function HomePage() {
  try {
    const { defaultTenant } = await api<{ defaultTenant: string }>(
      '/api/account/default-tenant',
      { cache: 'no-store' },
    );
    redirect(`/${defaultTenant || 'default'}/dashboard`);
  } catch {
    redirect('/login');
  }
}
