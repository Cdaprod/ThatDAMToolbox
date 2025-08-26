import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import path from 'node:path'

const sidebarPath = path.resolve(__dirname, '../../hooks/useSidebar.js')
const modalPath = path.resolve(__dirname, '../../providers/ModalProvider.js')
const themePath = path.resolve(__dirname, '../../context/ThemeContext.js')
const authPath = path.resolve(__dirname, '../../providers/AuthProvider.js')

const sidebarMod = require(sidebarPath)
const modalMod = require(modalPath)
const themeMod = require(themePath)
const authMod = require(authPath)

sidebarMod.useSidebar = () => ({ collapsed: false, setCollapsed() {} })
modalMod.useModal = () => ({ openModal() {}, closeModal() {} })
themeMod.useTheme = () => ({ scheme: 'light', setScheme() {} })
authMod.useAuth = () => ({ user: { name: 'A' }, logout() {} })

const topBarPath = path.resolve(__dirname, '../TopBar.js')
const { default: TopBar } = require(topBarPath)

test('TopBar shows theme dropdown', () => {
  const html = renderToString(<TopBar />)
  assert.ok(html.includes('Select color scheme'))
})

test('TopBar renders account menu button', () => {
  const html = renderToString(<TopBar />)
  assert.ok(html.includes('Account menu'))
})

test('TopBar includes service status chip', () => {
  const html = renderToString(<TopBar />)
  assert.ok(html.includes('Local-only'))
})

test('Explorer button triggers dam-explorer modal', async () => {
  let opened: string | null = null
  modalMod.useModal = () => ({ openModal: (tool: string) => { opened = tool }, closeModal() {} })
  delete require.cache[topBarPath]
  const { default: TestTopBar } = await import('../TopBar')
  const el = TestTopBar()
  const nav = el.props.children[1]
  const button = nav.props.children[2]
  button.props.onClick()
  modalMod.useModal = () => ({ openModal() {}, closeModal() {} })
  delete require.cache[topBarPath]
  assert.equal(opened, 'dam-explorer')
})

test('Account menu logout triggers logout handler', async () => {
  let loggedOut = false
  authMod.useAuth = () => ({ user: { name: 'A' }, logout: () => { loggedOut = true } })
  delete require.cache[topBarPath]
  const { default: TestTopBar } = await import('../TopBar')
  const el = TestTopBar()
  const nav = el.props.children[1]
  const menuWrapper = nav.props.children[3]
  const button = menuWrapper.props.children[0]
  button.props.onClick()
  const menu = menuWrapper.props.children[1]
  const logoutBtn = menu.props.children[1]
  logoutBtn.props.onClick()
  authMod.useAuth = () => ({ user: { name: 'A' }, logout() {} })
  delete require.cache[topBarPath]
  assert.ok(loggedOut)
})

test('Account menu hidden when user missing', () => {
  authMod.useAuth = () => ({ user: null, logout() {} })
  delete require.cache[topBarPath]
  const { default: TestTopBar } = require(topBarPath)
  const html = renderToString(<TestTopBar />)
  authMod.useAuth = () => ({ user: { name: 'A' }, logout() {} })
  delete require.cache[topBarPath]
  assert.ok(!html.includes('Account menu'))
})

test('Click outside closes account menu', async () => {
  const events: Record<string, (e: any) => void> = {}
  ;(global as any).document = {
    addEventListener: (t: string, cb: any) => { events[t] = cb },
    removeEventListener: (t: string) => { delete events[t] },
  }
  delete require.cache[topBarPath]
  const { default: TestTopBar } = await import('../TopBar')
  const el = TestTopBar()
  const nav = el.props.children[1]
  const menuWrapper = nav.props.children[3]
  const button = menuWrapper.props.children[0]
  button.props.onClick()
  events['mousedown']({ target: {} })
  assert.ok(!events['mousedown'])
  delete (global as any).document
})
