// src/providers/AppProviders.tsx
'use client'

import { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'

import { ThemeProvider } from '@/context/ThemeContext'
import VideoSocketProvider from './VideoSocketProvider'
import AssetProvider from './AssetProvider'
import ModalProvider from './ModalProvider'
import ActionSheet from '@/components/modals/ActionSheet'
import { SidebarProvider } from '../hooks/useSidebar'
import AuthProvider from './AuthProvider'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failCount, error: any) => (error?.status === 404 ? 0 : Math.min(failCount, 2)),
    },
    mutations: { retry: 0 },
  },
})

// Devtools (TanStack)
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools), {
        ssr: false,
      })
    : () => null

const RouteProgress = dynamic(() => import('@/components/ui/RouteProgress'), { ssr: false })
const GlobalBackdrop = dynamic(() => import('@/components/ui/GlobalBackdrop'), { ssr: false })
// ← point at your unified CaptureProvider, not "CaptureProviderImpl"
const CaptureProvider = dynamic(() => import('./CaptureProvider'), { ssr: false })

export default function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('react-devtools-core')
        .then(({ connectToDevTools }) =>
          connectToDevTools({ host: window.location.hostname, port: 8097 })
        )
        .catch(() => {
          // Ignore devtools connection errors in development.
        })
    }
  }, [])

  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <SidebarProvider>
            <AssetProvider>
              <VideoSocketProvider>
                {/* immersive in-between UI */}
                <RouteProgress />
                <GlobalBackdrop />
                <CaptureProvider>
                  <ModalProvider>
                    {children}
                    <ActionSheet />
                  </ModalProvider>
                </CaptureProvider>
                <ReactQueryDevtools initialIsOpen={false} />
              </VideoSocketProvider>
            </AssetProvider>
          </SidebarProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
