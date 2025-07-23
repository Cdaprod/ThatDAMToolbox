// /docker/web-app/src/providers/AppProviders.tsx
'use client';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import dynamic from 'next/dynamic';

import VideoSocketProvider from './VideoSocketProvider';
import AssetProvider       from './AssetProvider';
import ModalProvider       from './ModalProvider';

const qc = new QueryClient();

/* code-split CaptureProviderImpl; never runs on server */
const CaptureProvider = dynamic(
  () => import('./CaptureProviderImpl'),
  { ssr: false }
);

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <VideoSocketProvider>
        <AssetProvider>
          <CaptureProvider>
            <ModalProvider>{children}</ModalProvider>
          </CaptureProvider>
        </AssetProvider>
      </VideoSocketProvider>

      <ReactQueryDevtools position="bottom-right" initialIsOpen={false} />
    </QueryClientProvider>
  );
}