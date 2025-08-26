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
} from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { setAuthToken } from '../lib/api';
import {
  setDefaultTenantCookie,
  clearDefaultTenantCookie,
} from '@/lib/tenancy/cookieClient';

interface AuthState {
  token: string | null;
  tenantId: string | null;
  user: { name?: string } | null;
  login: (
    token: string,
    user?: { name?: string },
    tenantId?: string,
  ) => void;
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
  const [tenantId, setTenantId] = useState<string | null>(() => {
    if (initialTenantId) return initialTenantId;
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)cda_tenant=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
    return null;
  });
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [mounted, setMounted] = useState(process.env.NODE_ENV === 'test');
  const redirected = useRef(false);

  useEffect(() => setMounted(true), []);

  const login = (t: string, u?: { name?: string }, tenant?: string) => {
    setToken(t);
    setUser(u ?? null);
    setTenantId(tenant ?? null);
    if (tenant) {
      setDefaultTenantCookie(tenant).catch(() => {});
    }
    setAuthToken(t);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTenantId(null);
    clearDefaultTenantCookie().catch(() => {});
    setAuthToken(null);
    // ensure server-side session cookies are cleared
    signOut({ callbackUrl: '/login' });
  };

  const publicRoutes = ['/', '/login', '/signup', '/pair'];
  const isDashboardPath = pathname.includes('/dashboard');

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
