'use client';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import VideoSocketProvider from './VideoSocketProvider';
import AssetProvider       from './AssetProvider';
import ModalProvider       from './ModalProvider';

const qc = new QueryClient();

/* dev-only DevTools – tree-shaken from prod */
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() =>
        import('@tanstack/react-query-devtools')
          .then(m => m.ReactQueryDevtools), { ssr: false })
    : () => null;

/* code-split CaptureProviderImpl; never runs on the server */
const CaptureProvider = dynamic(() => import('./CaptureProviderImpl'), {
  ssr: false,
});

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