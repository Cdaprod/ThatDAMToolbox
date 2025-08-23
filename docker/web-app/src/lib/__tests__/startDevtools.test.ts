import test from 'node:test'
import assert from 'node:assert'
import { maybeConnectReactDevTools } from '../reactDevtools.js'

// Example: node --test src/lib/__tests__/startDevtools.test.ts

test('maybeConnectReactDevTools is a no-op without window', () => {
  let warned = 0
  const originalWarn = console.warn
  console.warn = () => { warned++ }

  const prevEnv = process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS = '1'
  delete (globalThis as any).window

  maybeConnectReactDevTools('dev')

  assert.strictEqual(warned, 0)

  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS = prevEnv
  console.warn = originalWarn
})
