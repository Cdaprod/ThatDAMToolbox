// hooks/useTheme.ts
import { useEffect } from 'react'

export default function useTheme(name: 'light'|'dark') {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', name)
  }, [name])
}