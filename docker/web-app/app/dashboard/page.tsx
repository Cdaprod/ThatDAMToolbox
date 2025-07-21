//app/dashboard/page.tsx
'use client';
import ExplorerCard from '@/components/ExplorerCard';
import UploadCard from '@/components/UploadCard';
// ...etc

export default function DashboardMain() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <ExplorerCard />
      <UploadCard />
      {/* ...rest of your cards */}
    </div>
  );
}