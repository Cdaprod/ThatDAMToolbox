import test from 'node:test'
import assert from 'node:assert'
import { maybeConnectReactDevTools } from '../reactDevtools.js'

// Example: node --test src/lib/__tests__/startDevtools.test.ts

test('maybeConnectReactDevTools is a no-op outside dev mode', () => {
  let logged = 0
  const originalLog = console.log
  console.log = () => { logged++ }

  maybeConnectReactDevTools('start')

  assert.strictEqual(logged, 0)

  console.log = originalLog
})
