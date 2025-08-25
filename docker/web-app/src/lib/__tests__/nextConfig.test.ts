import assert from 'node:assert';
import test from 'node:test';
import pkg from '../../../package.json';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants.js';

test('next.config defines caching headers without unsupported flags', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: createConfig } = await import('../../../next.config.mjs');
  const config = (createConfig as any)(PHASE_DEVELOPMENT_SERVER);
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.ok(staticRule, 'static header rule missing');
  assert.ok(!(config as any).experimental?.precompile, 'precompile flag should be removed');
});

test('disables static asset caching in development', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: createConfig } = await import('../../../next.config.mjs');
  const config = (createConfig as any)(PHASE_DEVELOPMENT_SERVER);
  const origEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = 'development';
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.equal(staticRule.headers[0].value, 'no-store');
  (process.env as any).NODE_ENV = origEnv;
});

test('caches static assets in production', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: createConfig } = await import('../../../next.config.mjs');
  const config = (createConfig as any)(PHASE_PRODUCTION_SERVER);
  const origEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = 'production';
  const headers = await (config as any).headers();
  const staticRule = headers.find((h: any) => h.source === '/_next/static/:path*');
  assert.equal(
    staticRule.headers[0].value,
    'public, max-age=31536000, immutable',
  );
  (process.env as any).NODE_ENV = origEnv;
});

test('dev phase keeps compiled pages warm and allows LAN origins', async () => {
  // @ts-ignore next.config.mjs has no type declarations
  const { default: createConfig } = await import('../../../next.config.mjs');
  const config = (createConfig as any)(PHASE_DEVELOPMENT_SERVER);
  assert.equal((config as any).onDemandEntries?.maxInactiveAge, 300_000);
  assert.equal((config as any).onDemandEntries?.pagesBufferLength, 20);
  assert.deepEqual((config as any).allowedDevOrigins, [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.0.22:3000',
  ]);
});

test('Next.js version is at least 14', () => {
  const version = pkg.dependencies?.next?.replace(/^\D*/, '') || '0.0.0';
  const [major] = version.split('.').map(Number);
  assert.ok(major >= 14, `Next.js version ${version} is too old`);
});
