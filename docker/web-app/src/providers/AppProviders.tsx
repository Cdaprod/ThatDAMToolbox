// src/providers/AppProviders.tsx
'use client'

import { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dynamic             from 'next/dynamic'

import { ThemeProvider }   from '@/context/ThemeContext'
import VideoSocketProvider from './VideoSocketProvider'
import AssetProvider       from './AssetProvider'
import ModalProvider       from './ModalProvider'
import ActionSheet         from '@/components/modals/ActionSheet'
import { SidebarProvider } from '../hooks/useSidebar'
import AuthProvider        from './AuthProvider'

const qc = new QueryClient()

import { ReactQueryDevtools } from './loadReactQueryDevtools'

// ← point at your unified CaptureProvider, not "CaptureProviderImpl"
const CaptureProvider = dynamic(
  () => import('./CaptureProvider'),
  { ssr: false }
)

export default function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const DEV = process.env.NODE_ENV === 'development'
    const ENABLED = process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== '0'

    if (!DEV || !ENABLED) return
    if (typeof window === 'undefined') return
    // @ts-ignore – Next sets this in edge runtimes
    if (typeof (globalThis as any).EdgeRuntime !== 'undefined') return

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectToDevTools } = require('react-devtools-core')
    const port = Number(process.env.NEXT_PUBLIC_REACT_DEVTOOLS_PORT ?? 8097)
    connectToDevTools({ host: 'localhost', port })
  }, [])

  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <SidebarProvider>
          <ThemeProvider>
            <VideoSocketProvider>
              <CaptureProvider>
                <AssetProvider>
                  <ModalProvider>
                    {children}
                    <ActionSheet />
                  </ModalProvider>
                </AssetProvider>
              </CaptureProvider>
            </VideoSocketProvider>
          </ThemeProvider>
        </SidebarProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
