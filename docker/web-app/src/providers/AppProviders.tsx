'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import TenantProvider from '@/providers/TenantProvider';
import AssetProvider from '@/providers/AssetProvider';
import VideoSocketProvider from '@/providers/VideoSocketProvider';
import ModalProvider from '@/providers/ModalProvider';
import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools';

const qc = new QueryClient();

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>
        <TenantProvider>
          <AssetProvider>
            <VideoSocketProvider>
              <ModalProvider>
                {children}
                <LoadReactQueryDevtools />
              </ModalProvider>
            </VideoSocketProvider>
          </AssetProvider>
        </TenantProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
