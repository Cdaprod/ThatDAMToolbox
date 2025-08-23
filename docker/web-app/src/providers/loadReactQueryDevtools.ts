import type { ComponentType } from 'react'

/**
 * Dynamically loads React Query Devtools. If the package is missing,
 * a no-op component is returned instead. Example:
 * const Devtools = await loadReactQueryDevtools()
 */
export async function loadReactQueryDevtools(
  modPath = '@tanstack/react-query-devtools',
): Promise<ComponentType | (() => null)> {
  try {
    const mod = await import(modPath)
    return mod.ReactQueryDevtools
  } catch {
    return () => null
  }
}
