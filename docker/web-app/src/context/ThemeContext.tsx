// /src/context/ThemeContext.tsx
import { ReactNode, useEffect } from 'react'

// Single theme applied across the app to avoid a route-based rainbow
const THEME_VARS: Record<string, string> = {
  '--theme-background': '#f0f4ff',
  '--theme-primary':    '#1e40af',
  '--theme-accent':     '#3b82f6',
}

export function deriveThemeId(_: string) {
  return 'default'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    Object.entries(THEME_VARS).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    )
  }, [])

  return <>{children}</>
}

