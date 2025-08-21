// /docker/web-app/src/app/[tenant]/dashboard/page.tsx
'use client';

import DashboardLayout from '../../../components/DashboardLayout';
import AnalyticsCard from '../../../components/tools/AnalyticsCard';

export default function DashboardMain() {
  const hero = (
    <h1 className="text-4xl font-extrabold py-6 text-center">
      🎬 Cdaprods Video Dashboard
    </h1>
  );

  return <DashboardLayout hero={hero} analytics={<AnalyticsCard />} />;
}
