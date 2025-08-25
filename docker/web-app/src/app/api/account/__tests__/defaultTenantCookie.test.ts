/**
 * Tests for set/clear default tenant API routes.
 * Run with: npm test
 */
import assert from 'node:assert'
import test from 'node:test'
import { POST as setPost } from '../set-default-tenant/route'
import { POST as clearPost } from '../clear-default-tenant/route'

test('set-default-tenant sets cookie and returns payload', async () => {
  const req = new Request('http://example.com/api/account/set-default-tenant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'acme' }),
  })
  const res = await setPost(req as any)
  assert.equal(res.status, 200)
  const cookie = res.headers.get('set-cookie')
  assert.ok(cookie?.includes('cda_tenant=acme'))
  const data = await res.json()
  assert.deepStrictEqual(data, { ok: true, tenant: 'acme' })
})

test('clear-default-tenant removes cookie', async () => {
  const req = new Request('http://example.com/api/account/clear-default-tenant', {
    method: 'POST',
  })
  const res = await clearPost(req as any)
  assert.equal(res.status, 200)
  const cookie = res.headers.get('set-cookie')
  assert.ok(cookie?.includes('Max-Age=0'))
})
