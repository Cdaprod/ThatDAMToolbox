// /docker/web-app/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api/client';

/**
 * Root page that redirects to the user's default tenant dashboard
 * or to the login screen when unauthenticated.
 *
 * Example:
 *   visiting "/" -> "/acme/dashboard"
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const { defaultTenant } = await api<{ defaultTenant: string }>('/api/account/default-tenant');
        router.replace(`/${defaultTenant || 'default'}/dashboard`);
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  // Nothing is rendered because users are redirected immediately.
  return null;
}
