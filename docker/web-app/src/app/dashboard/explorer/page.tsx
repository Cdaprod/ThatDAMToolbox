//app/dashboard/explorer/page.tsx
'use client';
import ExplorerCard from '@/components/ExplorerCard';

export default function ExplorerPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Explorer</h1>
      <ExplorerCard />
    </div>
  );
}