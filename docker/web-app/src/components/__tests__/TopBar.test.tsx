import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import path from 'node:path'

import TopBar from '../TopBar'
import Sidebar from '../Sidebar'
import { SidebarProvider } from '../../hooks/useSidebar'
import MainLayout, { shouldHideSidebar } from '../../app/MainLayout'

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

test('Explorer button triggers dam-explorer modal', async () => {
  const sidebarPath = path.resolve(__dirname, '../../hooks/useSidebar.js')
  const modalPath = path.resolve(__dirname, '../../providers/ModalProvider.js')
  const topBarPath = path.resolve(__dirname, '../TopBar.js')

  const sidebarMod = require(sidebarPath)
  const modalMod = require(modalPath)
  const origUseSidebar = sidebarMod.useSidebar
  const origUseModal = modalMod.useModal

  let opened: string | null = null

  sidebarMod.useSidebar = () => ({ collapsed: false, setCollapsed() {} })
  modalMod.useModal = () => ({ openModal: (tool: string) => { opened = tool }, closeModal() {} })

  delete require.cache[topBarPath]
  const { default: TestTopBar } = await import('../TopBar')
  const el = TestTopBar()
  const nav = el.props.children[1]
  const button = nav.props.children
  button.props.onClick()

  assert.equal(opened, 'dam-explorer')

  sidebarMod.useSidebar = origUseSidebar
  modalMod.useModal = origUseModal
  delete require.cache[topBarPath]
})
