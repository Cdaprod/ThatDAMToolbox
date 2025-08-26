/**
 * Simple authentication context provider.
 *
 * Example:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
'use client';

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { setAuthToken } from '../lib/api';
import { setDefaultTenantCookie } from '../lib/tenancy/cookieClient';

interface AuthState {
  token: string | null;
  tenantId: string | null;
  user: { name?: string } | null;
  login: (
    token: string,
    user?: { name?: string },
    tenantId?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export default function AuthProvider({
  children,
  initialToken = null,
  initialTenantId = null,
}: {
  children: ReactNode;
  initialToken?: string | null;
  initialTenantId?: string | null;
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '/';

  const [token, setToken] = useState<string | null>(initialToken);
  const [tenantId, setTenantId] = useState<string | null>(initialTenantId);
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [mounted, setMounted] = useState(process.env.NODE_ENV === 'test');
  const redirected = useRef(false);

  useEffect(() => setMounted(true), []);

  const login = useCallback(
    async (t: string, u?: { name?: string }, tenant?: string) => {
      setToken(t);
      setUser(u ?? null);
      setAuthToken(t);

      const applyTenant = async (slug: string) => {
        setTenantId(slug);
        sessionStorage.setItem('tenantId', slug);
        try {
          await setDefaultTenantCookie(slug);
        } catch {}
      };

      if (tenant) {
        await applyTenant(tenant);
        return;
      }

      const url = process.env.NEXT_PUBLIC_TENANCY_URL;
      if (!url) return;
      try {
        const payloadB64 = t.split('.')[1];
        const decoded = JSON.parse(
          Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
        );
        const userID = decoded.sub || decoded.email;
        const res = await fetch(`${url}/login`, {
          method: 'POST',
          headers: { 'X-User-ID': userID },
        });
        if (!res.ok) return;
        const data = await res.json();
        const slug = data.slug || data.tenant_id;
        if (slug) await applyTenant(String(slug));
      } catch {
        // ignore
      }
    },
    [],
  );

  const logout = () => {
    setToken(null);
    setUser(null);
    setTenantId(null);
    sessionStorage.removeItem('tenantId');
    setAuthToken(null);
    // ensure server-side session cookies are cleared
    signOut({ callbackUrl: '/login' });
  };

  const publicRoutes = ['/', '/login', '/signup', '/pair'];
  const isDashboardPath = pathname.includes('/dashboard');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const init = () => {
      // @ts-ignore GIS attaches to window
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }: any) => {
          try {
            const payload = JSON.parse(
              Buffer.from(
                credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
                'base64',
              ).toString(),
            );
            login(credential, { name: payload.name });
          } catch {
            login(credential);
          }
        },
      });
    };
    // @ts-ignore GIS script may already be loaded
    if (window.google?.accounts?.id) {
      init();
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
    }
  }, [login]);

  useEffect(() => {
    if (!mounted) return;
    if (publicRoutes.includes(pathname)) return;
    if (!isDashboardPath) return;
    if (status === 'unauthenticated' && !redirected.current) {
      redirected.current = true;
      const qs = new URLSearchParams({ redirect: pathname }).toString();
      router.replace(`/login?${qs}`);
    }
  }, [mounted, pathname, status, router, isDashboardPath]);

  if (
    process.env.NODE_ENV === 'test' &&
    status === 'unauthenticated' &&
    isDashboardPath &&
    !publicRoutes.includes(pathname) &&
    !redirected.current
  ) {
    redirected.current = true;
    const qs = new URLSearchParams({ redirect: pathname }).toString();
    router.replace(`/login?${qs}`);
  }

  if (!mounted || status === 'loading') {
    return <div data-auth-placeholder="" style={{ display: 'contents' }} />;
  }

  return (
    <AuthContext.Provider value={{ token, tenantId, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
