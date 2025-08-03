// /src/context/ThemeContext.tsx
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { dashboardTools, DashboardTool } from '@/components/dashboardTools'

type Theme = {
  background: string
  primary: string
  accent: string
}

const THEME_MAP: Record<string, {background:string; primary:string; accent:string}> = {
  'camera-monitor': {
    background: '#eef2ff',  // indigo-50
    primary:    '#6366f1',  // indigo-500
    accent:     '#c7d2fe',  // indigo-200
  },
  'dam-explorer': {
    background: '#f5f3ff',  // purple-50
    primary:    '#8b5cf6',  // purple-500
    accent:     '#ddd6fe',  // purple-200
  },
  'motion': {
    background: '#fdf2f8',  // pink-50
    primary:    '#ec4899',  // pink-500
    accent:     '#f9a8d4',  // pink-200
  },
  'live': {
    background: '#f0fdf4',  // green-50
    primary:    '#22c55e',  // green-500
    accent:     '#86efac',  // green-200
  },
  'witness': {
    background: '#fffbeb',  // yellow-50
    primary:    '#eab308',  // yellow-500
    accent:     '#fef08a',  // yellow-200
  },
  'explorer': {
    background: '#eff6ff',  // blue-50
    primary:    '#3b82f6',  // blue-500
    accent:     '#bfdbfe',  // blue-200
  },
}

const ThemeContext = createContext<Theme>(THEME_MAP['camera-monitor'])

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<Theme>(THEME_MAP['camera-monitor'])

  useEffect(() => {
    // extract "camera-monitor" etc from /dashboard/[tool]
    const id = pathname.split('/')[2] || 'camera-monitor'
    setTheme(THEME_MAP[id] ?? THEME_MAP['camera-monitor'])
  }, [pathname])

  useEffect(() => {
    // apply CSS vars
    for (const [k, v] of Object.entries(theme)) {
      document.documentElement.style.setProperty(`--theme-${k}`, v)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)