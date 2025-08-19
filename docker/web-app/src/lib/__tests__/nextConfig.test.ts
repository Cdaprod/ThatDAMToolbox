import assert from 'node:assert';
import test from 'node:test';
import config from '../../../next.config.js';

test('next.config defines caching headers', async () => {
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.ok(staticRule, 'static header rule missing');
});
