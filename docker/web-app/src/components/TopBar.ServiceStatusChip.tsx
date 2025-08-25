'use client'
import { AppConfig } from '../lib/config'
import { useEffect, useState } from 'react'

export function labelFor(ok: null | boolean) {
  return ok === null ? 'Local-only' : ok ? 'media-api: OK' : 'media-api: down'
}

export async function probeMediaApi(): Promise<null | boolean> {
  if (!AppConfig.mediaApiBase) return null
  try {
    const res = await fetch(`${AppConfig.mediaApiBase}/health`, { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Displays status of media-api service.
 *
 * Example:
 *   <ServiceStatusChip />
 */
export default function ServiceStatusChip() {
  const [ok, setOk] = useState<null | boolean>(null)
  useEffect(() => { probeMediaApi().then(setOk) }, [])
  return (
    <span className="text-xs px-2 py-1 rounded border">{labelFor(ok)}</span>
  )
}
