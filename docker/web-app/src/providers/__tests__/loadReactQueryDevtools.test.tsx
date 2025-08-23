import test from 'node:test'
import assert from 'node:assert'
import { loadReactQueryDevtools } from '../loadReactQueryDevtools'

// Ensures the helper falls back to a no-op when the devtools package
// is missing. Example: node --test loadReactQueryDevtools.test.tsx

test('falls back to no-op component when module missing', async () => {
  const Comp = await loadReactQueryDevtools('non-existent-module')
  assert.strictEqual(typeof Comp, 'function')
  assert.strictEqual((Comp as any)(), null)
})
