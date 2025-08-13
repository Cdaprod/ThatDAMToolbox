// Tests for negotiateWHEP helper
// Example: node --test useCameraStream.test.ts
import test from 'node:test'
import assert from 'node:assert'
import { negotiateWHEP } from '../useCameraStream'

test('negotiateWHEP posts offer and returns answer', async () => {
  const calls: any[] = []
  // mock fetch
  ;(global as any).fetch = async (url: string, opts: any) => {
    calls.push({ url, opts })
    return {
      ok: true,
      json: async () => ({ sdp: 'answer-sdp' })
    }
  }

  const ans = await negotiateWHEP('/whep/room1', 'offer-sdp')
  assert.strictEqual(ans, 'answer-sdp')
  assert.strictEqual(calls[0].url, '/whep/room1')
  const body = JSON.parse(calls[0].opts.body)
  assert.strictEqual(body.sdp, 'offer-sdp')
})
