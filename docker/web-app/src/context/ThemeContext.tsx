// /src/context/ThemeContext.tsx
import { ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Map of route -> CSS variable overrides
const THEME_MAP: Record<string, Record<string, string>> = {
  'camera-monitor': {
    '--theme-background': '#eef2ff',
    '--theme-primary':    '#6366f1',
    '--theme-accent':     '#c7d2fe',
  },
  'dam-explorer': {
    '--theme-background': '#f5f3ff',
    '--theme-primary':    '#8b5cf6',
    '--theme-accent':     '#ddd6fe',
  },
  motion: {
    '--theme-background': '#fdf2f8',
    '--theme-primary':    '#ec4899',
    '--theme-accent':     '#f9a8d4',
  },
  live: {
    '--theme-background': '#f0fdf4',
    '--theme-primary':    '#22c55e',
    '--theme-accent':     '#86efac',
  },
  witness: {
    '--theme-background': '#fffbeb',
    '--theme-primary':    '#eab308',
    '--theme-accent':     '#fef08a',
  },
  explorer: {
    '--theme-background': '#eff6ff',
    '--theme-primary':    '#3b82f6',
    '--theme-accent':     '#bfdbfe',
  },
}

export function deriveThemeId(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const last = segments.pop()
  return last && THEME_MAP[last] ? last : 'camera-monitor'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    const id = deriveThemeId(pathname)
    const themeVars = THEME_MAP[id] ?? THEME_MAP['camera-monitor']
    Object.entries(themeVars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    )
  }, [pathname])

  return <>{children}</>
}

