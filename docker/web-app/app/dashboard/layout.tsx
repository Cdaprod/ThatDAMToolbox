// /app/dashboard/layout.tsx
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';

export const metadata = { title: 'Dashboard • Video DAM' }; // optional

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}