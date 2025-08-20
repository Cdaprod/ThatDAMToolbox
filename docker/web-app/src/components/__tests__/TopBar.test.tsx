import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'

import TopBar from '../TopBar'
import Sidebar from '../Sidebar'
import { SidebarProvider } from '../../hooks/useSidebar'
import MainLayout, { shouldHideSidebar } from '../../app/MainLayout'
import TenantProvider from '@/providers/TenantProvider'

test('TopBar renders sidebar toggle', () => {
  const html = renderToString(
    <SidebarProvider>
      <TopBar />
    </SidebarProvider>
  )
  assert.ok(html.includes('Toggle sidebar'))
})

test('Sidebar shows titles when expanded', () => {
  const html = renderToString(
    <SidebarProvider initialCollapsed={false}>
      <Sidebar />
    </SidebarProvider>
  )
  assert.ok(html.includes('Camera Monitor'))
})

test('MainLayout shows sidebar on camera monitor route', () => {
  assert.equal(shouldHideSidebar('/dashboard/camera-monitor'), false)
})

test('TopBar link includes tenant', () => {
  const html = renderToString(
    <TenantProvider tenant="acme">
      <SidebarProvider>
        <TopBar />
      </SidebarProvider>
    </TenantProvider>
  )
  assert.ok(html.includes('/acme/dashboard/dam-explorer'))
})
