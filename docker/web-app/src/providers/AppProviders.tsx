'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';

import QueryProvider from './QueryProvider';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
