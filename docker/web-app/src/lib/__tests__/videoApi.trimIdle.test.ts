import assert from 'node:assert'
import test from 'node:test'
import { videoApi } from '../videoApi'

class MockResponse extends Response {
  constructor() { super(new Blob(), { status: 200 }) }
}

test('trimIdle sends freeze_dur in form data', async () => {
  const file = new File(['data'], 'demo.mp4', { type: 'video/mp4' })
  let body: any = null
  const orig = global.fetch
  global.fetch = async (_url: any, init: any) => {
    body = init.body
    return new MockResponse()
  }
  await videoApi.trimIdle({ file, freeze_dur: 5 })
  assert.equal(body.get('freeze_dur'), '5')
  global.fetch = orig
})
