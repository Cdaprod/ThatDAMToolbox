// /app/layout.tsx
import '@/styles/globals.css';
import Providers from './providers';
import TopBar from '@/components/TopBar';
import MainLayout from '@/components/MainLayout'; // new client component

export const metadata = {
  title: '🎬 Video Dashboard',
  description: 'Next.js + Python Video DAM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
        <Providers>
          <TopBar />
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}