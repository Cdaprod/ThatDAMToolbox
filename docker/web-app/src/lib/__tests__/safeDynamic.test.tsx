import test from 'node:test';
import assert from 'node:assert/strict';
import safeDynamic from '../safeDynamic';

// Example: node --test src/lib/__tests__/safeDynamic.test.tsx

test('safeDynamic logs when loader yields non-component', async () => {
  const original = console.error;
  const calls: any[] = [];
  console.error = (err: any) => calls.push(err);

  const Comp = safeDynamic(async () => ({ notAComponent: true }));
  await (Comp as any).__loader();

  assert.ok(calls.length > 0);
  assert.match(String(calls[0]), /loader did not return a React component/);

  console.error = original;
});

test('safeDynamic resolves default export', async () => {
  const Comp = safeDynamic(async () => ({ default: () => null }));
  const mod = await (Comp as any).__loader();
  assert.equal(typeof mod.default, 'function');
});

