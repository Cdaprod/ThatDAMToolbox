/**
 * Client helpers for managing the `cda_tenant` cookie via API routes.
 *
 * Usage:
 *   await setDefaultTenantCookie('demo')
 *   await clearDefaultTenantCookie()
 */
export async function setDefaultTenantCookie(slug: string) {
  const res = await fetch('/api/account/set-default-tenant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  })
  if (!res.ok) throw new Error('Failed to set default tenant')
}

export async function clearDefaultTenantCookie() {
  const res = await fetch('/api/account/clear-default-tenant', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to clear default tenant')
}
