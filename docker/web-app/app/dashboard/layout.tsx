//app/dashboard/layout.tsx
'use client'; // (if Sidebar or children are interactive)

import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 p-4 overflow-auto">
        {children}
      </main>
    </div>
  );
}