'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';

import TenantProvider from '@/providers/TenantProvider';
import AuthProvider from '@/providers/AuthProvider';
import AssetProvider from '@/providers/AssetProvider';
import VideoSocketProvider from '@/providers/VideoSocketProvider';
import ModalProvider from '@/providers/ModalProvider';
import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools';
import ClientOnly from '@/providers/ClientOnly';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  // Keep a single QueryClient across HMR in dev
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            suspense: false,
          },
        },
      })
  );

  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchInterval={0}
    >
      <QueryClientProvider client={qc}>
        <ClientOnly>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
          </ThemeProvider>
        </ClientOnly>
      </QueryClientProvider>
    </SessionProvider>
  );
}
