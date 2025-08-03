// /src/app/dashboard/layout.tsx
export const metadata = { title: 'Dashboard • Video DAM' }; // optional

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-6 transition-colors duration-200 bg-theme-background text-theme-primary"
          {children}
        </main>
      </div>
    </div>
  );
}