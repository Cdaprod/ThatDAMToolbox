// /docker/web-app/src/app/dashboard/page.tsx
'use client';

import { dashboardTools } from '@/components/dashboardTools'
import ToolCard from '@/components/ToolCard'
import AnalyticsCard from '@/components/tools/AnalyticsCard'
import { useIntelligentLayout } from '@/hooks/useIntelligentLayout'

export default function DashboardMain() {
  const tools = Object.values(dashboardTools)
  const { layoutGroups } = useIntelligentLayout(tools)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <AnalyticsCard />

      <section className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {layoutGroups.primary.map(t => (
            <ToolCard key={t.id} toolId={t.id} />
          ))}
        </div>
        {layoutGroups.secondary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {layoutGroups.secondary.map(t => (
              <ToolCard key={t.id} toolId={t.id} isRelated />
            ))}
          </div>
        )}
        {layoutGroups.tertiary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {layoutGroups.tertiary.map(t => (
              <ToolCard key={t.id} toolId={t.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}