'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';

import LoadReactQueryDevtools from './loadReactQueryDevtools';

let singletonQc: QueryClient | null = null;
function getClient() {
  if (!singletonQc) singletonQc = new QueryClient();
  return singletonQc;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  const [qc] = useState(getClient);

  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>
        {children}
        <LoadReactQueryDevtools />
      </QueryClientProvider>
    </SessionProvider>
  );
}
