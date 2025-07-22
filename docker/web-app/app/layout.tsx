// /app/layout.tsx
'use client'

import '../styles/globals.css'
import useTheme from '../hooks/useTheme'

export const metadata = {
  title: '🎬 Video Dashboard',
  description: 'Next.js + Python Video DAM'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    // default to dark, or read from localStorage
  useTheme('dark')
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}