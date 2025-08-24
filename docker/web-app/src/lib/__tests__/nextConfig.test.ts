import assert from 'node:assert';
import test from 'node:test';
import pkg from '../../../package.json';

test('next.config defines caching headers without unsupported flags', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: config } = await import('../../../next.config.mjs');
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.ok(staticRule, 'static header rule missing');
  assert.ok(!(config as any).experimental?.precompile, 'precompile flag should be removed');
});

test('Next.js version is at least 14', () => {
  const version = pkg.dependencies?.next?.replace(/^\D*/, '') || '0.0.0';
  const [major] = version.split('.').map(Number);
  assert.ok(major >= 14, `Next.js version ${version} is too old`);
});
