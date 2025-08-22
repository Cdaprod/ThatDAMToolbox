// /src/app/layout.tsx
import '@/styles/globals.css';
import AppProviders from '@/providers/AppProviders';
import AppToast from '@/providers/AppToast';
import TopBar from '@/components/TopBar';
import MainLayout from './MainLayout'; // new client component

export const metadata = {
  title: '🎬 Video Dashboard',
  description: 'Next.js + Python Video DAM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col dark:bg-neutral-800">
        <AppProviders>
          <AppToast>
            <TopBar />
            <MainLayout>{children}</MainLayout>
          </AppToast>
        </AppProviders>
      </body>
    </html>
  );
}