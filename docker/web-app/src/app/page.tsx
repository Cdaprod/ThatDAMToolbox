// /docker/web-app/src/app/page.tsx

'use client';

import ToolCard from '@/components/ToolCard';
import { dashboardTools } from '@/components/dashboardTools';

export default function HomePage() {
  return (
    <section className="w-full h-full flex flex-col items-center">
      {/* --- hero / status banner --------------------------------------- */}
      <header className="w-full max-w-5xl mb-8">
        <h1 className="text-4xl font-extrabold py-6 text-center">
          🎬 Cdaprods Video Dashboard
        </h1>
      </header>

      {/* --- grid of cards (overview) ----------------------------------- */}
      <div className="grid gap-6 w-full max-w-6xl grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardTools.map(({ href }) => (
          <ToolCard key={href} href={href} />
        ))}
      </div>
    </section>
  );
}