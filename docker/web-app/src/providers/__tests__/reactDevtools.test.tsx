import test from 'node:test';
import assert from 'node:assert';

// basic sanity test to ensure react-devtools-core is available
// Example: node --test src/providers/__tests__/reactDevtools.test.tsx

test('react-devtools-core exposes connectToDevTools', async () => {
  // react-devtools-core expects a global `self` even in Node.
  (globalThis as any).self = globalThis;
  const mod = await import('react-devtools-core');
  assert.strictEqual(typeof mod.connectToDevTools, 'function');
});
