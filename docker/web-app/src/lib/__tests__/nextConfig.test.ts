import assert from 'node:assert';
import test from 'node:test';

test('next.config defines caching headers', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: config } = await import('../../../next.config.mjs');
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.ok(staticRule, 'static header rule missing');
});
