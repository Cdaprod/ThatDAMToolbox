import assert from 'node:assert'
import test from 'node:test'
import { mediaApi } from '../mediaApi'
import type { EDL } from '../edl'

class MockResponse extends Response {
  constructor() { super(new Blob(), { status: 200 }) }
}

test('renderEdl posts file and edl', async () => {
  const file = new File(['data'], 'demo.mp4', { type: 'video/mp4' })
  const edl: EDL = { sourceName: 'demo.mp4', duration: 1, kept: [{ start: 0, end: 1 }], version: 'v1' }
  let body: any = null
  const orig = global.fetch
  // @ts-ignore
  global.fetch = async (_url: any, init: any) => { body = init.body; return new MockResponse() }
  await mediaApi.renderEdl({ file, edl })
  assert.equal(body.get('file'), file)
  const edlBlob = body.get('edl') as Blob
  const text = await edlBlob.text()
  assert.match(text, /"version"/)
  global.fetch = orig
})
