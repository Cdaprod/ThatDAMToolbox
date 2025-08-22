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

// dev-only React Query Devtools
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@tanstack/react-query-devtools')
        .then(m => m.ReactQueryDevtools),
      { ssr: false })
    : () => null

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
    const DevTools = require('react-devtools-core/standalone')

    let el = document.getElementById('react-devtools')
    if (!el) {
      el = document.createElement('div')
      el.id = 'react-devtools'
      Object.assign(el.style, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        height: '38vh',
        zIndex: '2147483647',
        background: '#111',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      } as CSSStyleDeclaration)
      document.body.appendChild(el)
    }

    const port = Number(process.env.NEXT_PUBLIC_REACT_DEVTOOLS_PORT ?? 8097)
    DevTools.setContentDOMNode(el).startServer(port)
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
      {/* container for the embedded devtools UI */}
      <div id="react-devtools" />
    </QueryClientProvider>
  )
}
