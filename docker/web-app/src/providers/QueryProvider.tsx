'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LoadReactQueryDevtools from './loadReactQueryDevtools';

let client: QueryClient | null = null;
function getClient() {
  if (!client) client = new QueryClient();
  return client;
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [qc] = useState(getClient);

  return (
    <QueryClientProvider client={qc}>
      {children}
      <LoadReactQueryDevtools />
    </QueryClientProvider>
  );
}
