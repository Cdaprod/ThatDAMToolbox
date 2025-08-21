// /docker/web-app/src/app/page.tsx
'use client';

import DashboardLayout from '../components/DashboardLayout';

export default function HomePage() {
  const hero = (
    <h1 className="text-4xl font-extrabold py-6 text-center">
      🎬 Cdaprods Video Dashboard
    </h1>
  );

  return <DashboardLayout hero={hero} />;
}
