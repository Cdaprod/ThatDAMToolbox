import test from 'node:test'
import assert from 'node:assert'
import { createClaim } from '../ProvisionDeviceModal'

test('createClaim requests new claim and returns join command', async () => {
  const called: string[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string) => {
    called.push(url)
    return { ok: true, json: async () => ({ id: '1', command: 'join me' }) } as any
  }) as any

  const claim = await createClaim()
  assert.deepEqual(claim, { id: '1', command: 'join me' })
  assert.equal(called[0], '/api/claims/new')

  globalThis.fetch = originalFetch!
})
