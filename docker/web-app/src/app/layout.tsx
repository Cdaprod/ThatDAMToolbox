import '@/styles/globals.css';
import '@/styles/void.css';
import AppProviders from '@/providers/AppProviders';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ThatDAMToolbox',
  description: 'AIOps + DAM',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
