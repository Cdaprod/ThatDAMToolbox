'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clearDefaultTenantCookie } from '@/lib/tenancy/cookieClient'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Clears tenant cookie then triggers AuthProvider logout.
 */
export default function LogoutPage() {
  const r = useRouter()
  const { logout } = useAuth()
  useEffect(() => {
    ;(async () => {
      await clearDefaultTenantCookie()
      await logout()
      r.replace('/login')
    })()
  }, [r, logout])
  return <p className="p-6 text-sm text-zinc-400">Signing out…</p>
}
