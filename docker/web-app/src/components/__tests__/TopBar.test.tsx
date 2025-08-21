import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import path from 'node:path'

import TopBar from '../TopBar'
import Sidebar from '../Sidebar'
import { SidebarProvider } from '../../hooks/useSidebar'
import MainLayout, { shouldHideSidebar } from '../../app/MainLayout'
import TenantProvider from '@/providers/TenantProvider'
import { ThemeProvider } from '@/context/ThemeContext'

test('TopBar renders sidebar toggle', () => {
  const html = renderToString(
    <ThemeProvider>
      <SidebarProvider>
        <TopBar />
      </SidebarProvider>
    </ThemeProvider>
  )
  assert.ok(html.includes('Toggle sidebar'))
})

test('TopBar shows theme dropdown', () => {
  const html = renderToString(
    <ThemeProvider>
      <SidebarProvider>
        <TopBar />
      </SidebarProvider>
    </ThemeProvider>
  )
  assert.ok(html.includes('Select color scheme'))
  assert.ok(html.includes('sepia'))
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

test('Explorer button triggers dam-explorer modal', async () => {
  const sidebarPath = path.resolve(__dirname, '../../hooks/useSidebar.js')
  const modalPath = path.resolve(__dirname, '../../providers/ModalProvider.js')
  const themePath = path.resolve(__dirname, '../../context/ThemeContext.js')
  const topBarPath = path.resolve(__dirname, '../TopBar.js')

  const sidebarMod = require(sidebarPath)
  const modalMod = require(modalPath)
  const themeMod = require(themePath)
  const origUseSidebar = sidebarMod.useSidebar
  const origUseModal = modalMod.useModal
  const origUseTheme = themeMod.useTheme

  let opened: string | null = null

  sidebarMod.useSidebar = () => ({ collapsed: false, setCollapsed() {} })
  modalMod.useModal = () => ({ openModal: (tool: string) => { opened = tool }, closeModal() {} })
  themeMod.useTheme = () => ({ scheme: 'light', setScheme() {} })

  delete require.cache[topBarPath]
  const { default: TestTopBar } = await import('../TopBar')
  const el = TestTopBar()
  const nav = el.props.children[1]
  const button = nav.props.children[1]
  button.props.onClick()

  assert.equal(opened, 'dam-explorer')

  sidebarMod.useSidebar = origUseSidebar
  modalMod.useModal = origUseModal
  themeMod.useTheme = origUseTheme
  delete require.cache[topBarPath]

  assert.ok(opened)
})

test('TopBar link includes tenant', () => {
  const html = renderToString(
    <TenantProvider tenant="acme">
      <ThemeProvider>
        <SidebarProvider>
          <TopBar />
        </SidebarProvider>
      </ThemeProvider>
    </TenantProvider>
  )
  assert.ok(html.includes('/acme/dashboard/dam-explorer'))
})
