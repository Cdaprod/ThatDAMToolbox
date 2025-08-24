/**
 * Simple authentication context provider.
 *
 * Example:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { setAuthToken } from '../lib/api';

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
  const pathname = usePathname();

  const [token, setToken] = useState<string | null>(initialToken);
  const [tenantId, setTenantId] = useState<string | null>(initialTenantId);
  const [user, setUser] = useState<{ name?: string } | null>(null);

  const login = (t: string, u?: { name?: string }, tenant?: string) => {
    setToken(t);
    setUser(u ?? null);
    setTenantId(tenant ?? null);
    if (tenant) sessionStorage.setItem('tenantId', tenant);
    setAuthToken(t);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTenantId(null);
    sessionStorage.removeItem('tenantId');
    setAuthToken(null);
  };

  const publicRoutes = ['/', '/login', '/signup', '/pair'];
  const isDashboardPath = pathname?.includes('/dashboard');
  if (status === 'unauthenticated' && isDashboardPath && !publicRoutes.includes(pathname)) {
    router.replace('/login');
    return null;
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
