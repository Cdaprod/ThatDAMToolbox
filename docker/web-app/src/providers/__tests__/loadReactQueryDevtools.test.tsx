import test from 'node:test'
import assert from 'node:assert'
import { ReactQueryDevtools } from '../loadReactQueryDevtools'

// Ensures the wrapper exports a no-op component when devtools are disabled
// Example: node --test loadReactQueryDevtools.test.tsx

test('exports no-op component when disabled', () => {
  assert.strictEqual(typeof ReactQueryDevtools, 'function')
  assert.strictEqual((ReactQueryDevtools as any)(), null)
})

