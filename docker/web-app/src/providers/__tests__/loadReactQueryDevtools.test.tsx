import test from 'node:test'
import assert from 'node:assert'

// Ensures the wrapper remains a no-op when disabled and detects mobile UAs
// Example: node --test loadReactQueryDevtools.test.tsx

test('exports no-op component when disabled', () => {
  const mod = require('../loadReactQueryDevtools')
  assert.strictEqual(mod.shouldEnableDevtools(), false)
  assert.strictEqual(mod.default(), null)
})

test('shouldEnableDevtools disables on mobile user agents', () => {
  ;(process.env as any).NODE_ENV = 'development'
  ;(process.env as any).NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS = '1'
  ;(global as any).navigator = { userAgent: 'iPhone' }
  delete require.cache[require.resolve('../loadReactQueryDevtools')]
  const { shouldEnableDevtools } = require('../loadReactQueryDevtools')
  assert.strictEqual(shouldEnableDevtools(), false)
})

