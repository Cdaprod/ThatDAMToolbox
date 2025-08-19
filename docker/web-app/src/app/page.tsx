// /docker/web-app/src/app/page.tsx
'use client';

import ToolCard from '@/components/ToolCard';
import { dashboardTools } from '@/components/dashboardTools';
import { useIntelligentLayout } from '@/hooks/useIntelligentLayout';
import { gridStyle } from '@/styles/theme';

export default function HomePage() {
  const { layoutGroups, focusedTool, setFocusedTool } = useIntelligentLayout(
    Object.values(dashboardTools),
  );

  const handleFocus = (toolId: string) => setFocusedTool(toolId);

  return (
    <section className="w-full h-full flex flex-col items-center">
      {/* --- hero / status banner --------------------------------------- */}
      <header className="w-full max-w-5xl mb-8">
        <h1 className="text-4xl font-extrabold py-6 text-center">
          🎬 Cdaprods Video Dashboard
        </h1>
      </header>

      {/* Primary */}
      <section className="w-full max-w-6xl mb-12">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Active & Recent</h2>
        <div
          className="grid gap-6 w-full mx-auto px-4"
          style={gridStyle}
        >
          {layoutGroups.primary.map(tool => (
            <ToolCard
              key={tool.id}
              toolId={tool.id}
              size="large"
              onFocus={handleFocus}
            />
          ))}
        </div>
      </section>

      {/* Secondary */}
      {layoutGroups.secondary.length > 0 && (
        <section className="w-full max-w-6xl mb-12">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Related Tools</h2>
          <div
            className="grid gap-6 w-full mx-auto px-4"
            style={gridStyle}
          >
            {layoutGroups.secondary.map(tool => (
              <ToolCard
                key={tool.id}
                toolId={tool.id}
                size="medium"
                isRelated={
                  focusedTool != null &&
                  dashboardTools[focusedTool]?.relatedTools.includes(tool.id)
                }
                onFocus={handleFocus}
              />
            ))}
          </div>
        </section>
      )}

      {/* Tertiary */}
      {layoutGroups.tertiary.length > 0 && (
        <section className="w-full max-w-6xl mb-12">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Other Tools</h2>
          <div
            className="grid gap-6 w-full mx-auto px-4"
            style={gridStyle}
          >
            {layoutGroups.tertiary.map(tool => (
              <ToolCard
                key={tool.id}
                toolId={tool.id}
                size="small"
                onFocus={handleFocus}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}