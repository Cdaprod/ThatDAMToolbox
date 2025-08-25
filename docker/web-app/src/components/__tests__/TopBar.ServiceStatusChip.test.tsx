/**
 * Tests for ServiceStatusChip helpers.
 * Run with: npm test
 */
import assert from 'node:assert'
import test from 'node:test'
import { labelFor, probeMediaApi } from '../TopBar.ServiceStatusChip'
import { AppConfig } from '../../lib/config'

test('labelFor maps states to strings', () => {
  assert.equal(labelFor(null), 'Local-only')
  assert.equal(labelFor(true), 'media-api: OK')
  assert.equal(labelFor(false), 'media-api: down')
})

test('probeMediaApi resolves status', async t => {
  const origFetch = global.fetch
  t.after(() => { global.fetch = origFetch })
  ;(AppConfig as any).mediaApiBase = 'http://api'
  global.fetch = async () => new Response('', { status: 200 })
  assert.equal(await probeMediaApi(), true)
  global.fetch = async () => { throw new Error('x') }
  assert.equal(await probeMediaApi(), false)
  ;(AppConfig as any).mediaApiBase = ''
  assert.equal(await probeMediaApi(), null)
})
