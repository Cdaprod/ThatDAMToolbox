'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';

import TenantProvider from '@/providers/TenantProvider';
import AuthProvider from '@/providers/AuthProvider';
import AssetProvider from '@/providers/AssetProvider';
import VideoSocketProvider from '@/providers/VideoSocketProvider';
import ModalProvider from '@/providers/ModalProvider';
import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  // useState() ensures a single QueryClient instance across HMR in dev
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>
        <TenantProvider>
          <AuthProvider>
            <AssetProvider>
              <VideoSocketProvider>
                <ModalProvider>
                  {children}
                  <LoadReactQueryDevtools />
                </ModalProvider>
              </VideoSocketProvider>
            </AssetProvider>
          </AuthProvider>
        </TenantProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
