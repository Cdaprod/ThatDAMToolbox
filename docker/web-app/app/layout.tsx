// /app/layout.tsx
import '../styles/globals.css'

export const metadata = {
  title: '🎬 Video Dashboard',
  description: 'Next.js + Python Video DAM'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}