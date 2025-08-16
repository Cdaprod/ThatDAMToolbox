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
import { setAuthToken } from '../lib/api';

interface AuthState {
  token: string | null;
  user: { name?: string } | null;
  login: (token: string, user?: { name?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export default function AuthProvider({
  children,
  initialToken = null,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<{ name?: string } | null>(null);

  const login = (t: string, u?: { name?: string }) => {
    setToken(t);
    setUser(u ?? null);
    setAuthToken(t);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
