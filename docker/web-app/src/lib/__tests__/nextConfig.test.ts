import assert from 'node:assert';
import test from 'node:test';
import pkg from '../../../package.json';

test('next.config defines caching headers', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: config } = await import('../../../next.config.mjs');
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.ok(staticRule, 'static header rule missing');
  assert.equal((config as any).experimental?.precompile, true);
});

test('Next.js version supports precompile', () => {
  const version = pkg.dependencies?.next?.replace(/^\D*/, '') || '0.0.0';
  const [major, minor] = version.split('.').map(Number);
  assert.ok(
    major > 14 || (major === 14 && minor >= 2),
    `Next.js version ${version} is too old for precompile`
  );
});
