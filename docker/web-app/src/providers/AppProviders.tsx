'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import TenantProvider from '@/providers/TenantProvider';
import AuthProvider from '@/providers/AuthProvider';
import VideoSocketProvider from '@/providers/VideoSocketProvider';
import ModalProvider from '@/providers/ModalProvider';
import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools';

const qc = new QueryClient();

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>
        <TenantProvider>
          <AuthProvider>
            <VideoSocketProvider>
              <ModalProvider>
                {children}
                <LoadReactQueryDevtools />
              </ModalProvider>
            </VideoSocketProvider>
          </AuthProvider>
        </TenantProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
