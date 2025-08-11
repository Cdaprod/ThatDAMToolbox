// /src/app/layout.tsx
import '@cdaprod/design-tokens/tokens.css';
import '@/styles/globals.css';
import AppProviders from '@/providers/AppProviders';
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
          <TopBar />
          <MainLayout>{children}</MainLayout>
        </AppProviders>
      </body>
    </html>
  );
}
