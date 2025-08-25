'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setDefaultTenantCookie } from '@/lib/tenancy/cookieClient'

/**
 * Sets default tenant cookie then redirects to the tenant dashboard.
 */
export default function TenantRedirect({ tenant }: { tenant: string }) {
  const r = useRouter()
  useEffect(() => {
    ;(async () => {
      await setDefaultTenantCookie(tenant)
      r.replace(`/${tenant}/dashboard`)
    })()
  }, [tenant, r])
  return null
}
