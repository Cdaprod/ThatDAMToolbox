// /src/context/ThemeContext.tsx
// Wraps next-themes to expose color-scheme selection driven by tokens.
'use client'
import { ReactNode } from 'react'
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from 'next-themes'

export const AVAILABLE_SCHEMES = ['light', 'dark', 'sepia', 'royal'] as const
export type ColorScheme = (typeof AVAILABLE_SCHEMES)[number]

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
    >
      {children}
    </NextThemesProvider>
  )
}

export function useTheme() {
  const { theme, setTheme } = useNextTheme()
  return { scheme: (theme as ColorScheme) || 'light', setScheme: setTheme }
}

export function deriveThemeId(_: string): ColorScheme {
  return 'light'
}

