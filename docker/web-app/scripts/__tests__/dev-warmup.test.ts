import assert from 'node:assert'
import test from 'node:test'
import { getRoutes } from '../dev-warmup'

test('getRoutes prefixes default routes with tenant', () => {
  const origTenant = process.env.WARMUP_TENANT
  const origRoutes = process.env.WARM_ROUTES
  delete process.env.WARM_ROUTES
  process.env.WARMUP_TENANT = 'demo'
  assert.deepEqual(getRoutes(), [
    '/',
    '/demo/dashboard',
    '/demo/dashboard/camera-monitor',
    '/demo/dashboard/dam-explorer',
    '/demo/account',
  ])
  process.env.WARMUP_TENANT = origTenant
  if (origRoutes) process.env.WARM_ROUTES = origRoutes
  else delete process.env.WARM_ROUTES
})

test('custom WARM_ROUTES are tenant-aware', () => {
  const origTenant = process.env.WARMUP_TENANT
  const origRoutes = process.env.WARM_ROUTES
  process.env.WARMUP_TENANT = 'demo'
  process.env.WARM_ROUTES = '/,/dashboard,/api/ping'
  assert.deepEqual(getRoutes(), ['/', '/demo/dashboard', '/api/ping'])
  process.env.WARMUP_TENANT = origTenant
  if (origRoutes) process.env.WARM_ROUTES = origRoutes
  else delete process.env.WARM_ROUTES
})
