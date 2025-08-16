// /docker/web-app/src/app/dashboard/explorer/page.tsx
'use client';
import ExplorerCard from '@/components/ExplorerCard';

export default function ExplorerPage() {
  return (
    <section className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* default vertical card */}
        <ExplorerCard />

        {/* horizontal variant */}
        <ExplorerCard orientation="horizontal" title="Quick Access" />
      </div>
    </section>
  );
}