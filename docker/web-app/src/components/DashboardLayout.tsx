import React from 'react';
import ToolCard from './ToolCard';
import { dashboardTools, DashboardTool } from './dashboardTools';
import { useIntelligentLayout } from '../hooks/useIntelligentLayout';
import { gridStyle } from '../styles/theme';

interface DashboardLayoutProps {
  tools?: DashboardTool[];
  hero?: React.ReactNode;
  analytics?: React.ReactNode;
}

/**
 * Shared layout for dashboard pages. Renders optional hero and analytics
 * sections followed by the intelligent tool grid.
 */
export default function DashboardLayout({
  tools = Object.values(dashboardTools),
  hero,
  analytics,
}: DashboardLayoutProps) {
  const { layoutGroups, focusedTool, setFocusedTool } =
    useIntelligentLayout(tools);

  const handleFocus = (toolId: string) => setFocusedTool(toolId);

  return (
    <section className="w-full h-full flex flex-col items-center">
      {hero && <header className="w-full max-w-5xl mb-8">{hero}</header>}
      {analytics && (
        <div className="w-full max-w-5xl mb-6">{analytics}</div>
      )}

      <section className="w-full max-w-6xl mb-12">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Active & Recent
        </h2>
        <div className="grid gap-6 w-full mx-auto px-4" style={gridStyle}>
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

      {layoutGroups.secondary.length > 0 && (
        <section className="w-full max-w-6xl mb-12">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Related Tools
          </h2>
          <div className="grid gap-6 w-full mx-auto px-4" style={gridStyle}>
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

      {layoutGroups.tertiary.length > 0 && (
        <section className="w-full max-w-6xl mb-12">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Other Tools
          </h2>
          <div className="grid gap-6 w-full mx-auto px-4" style={gridStyle}>
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
