'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';

// keep CaptureProvider small; load it statically to avoid another dynamic layer
import CaptureProvider from './CaptureProvider';

const qc = new QueryClient();

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>
        <CaptureProvider>{children}</CaptureProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
