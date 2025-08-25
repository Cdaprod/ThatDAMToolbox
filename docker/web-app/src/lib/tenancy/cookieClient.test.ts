/**
 * Tests for cookieClient helpers.
 * Run with: npm test
 */
import assert from 'node:assert'
import test from 'node:test'
import { setDefaultTenantCookie, clearDefaultTenantCookie } from './cookieClient'

test('setDefaultTenantCookie surfaces errors', async t => {
  const origFetch = global.fetch
  t.after(() => { global.fetch = origFetch })
  global.fetch = async () => new Response('nope', { status: 500 })
  await assert.rejects(() => setDefaultTenantCookie('demo'))
})

test('clearDefaultTenantCookie surfaces errors', async t => {
  const origFetch = global.fetch
  t.after(() => { global.fetch = origFetch })
  global.fetch = async () => new Response('nope', { status: 500 })
  await assert.rejects(() => clearDefaultTenantCookie())
})
