import type { ReactNode, ComponentType } from 'react';

/**
 * Canonical dashboard tool definition.
 * Used to render cards and resolve dynamic tool pages.
 */
export interface DashboardTool {
  id: string;
  href: string;
  title: string;
  icon: ComponentType<any>;
  color: string;
  context: string;
  relatedTools: string[];
  lastUsed: string; // ISO timestamp
  status: 'active' | 'processing' | 'idle';
}

const registry: Record<string, DashboardTool> = {};

/**
 * Create a DashboardTool with sensible defaults.
 */
export function createTool(config: Omit<DashboardTool, 'lastUsed' | 'status' | 'relatedTools' | 'context' | 'color'> & Partial<Pick<DashboardTool, 'lastUsed' | 'status' | 'relatedTools' | 'context' | 'color'>>): DashboardTool {
  return {
    color: config.color ?? '',
    context: config.context ?? 'misc',
    relatedTools: config.relatedTools ?? [],
    lastUsed: config.lastUsed ?? new Date().toISOString(),
    status: config.status ?? 'idle',
    ...config,
  };
}

/**
 * Register a tool in the global dashboard registry.
 */
export function registerTool(tool: DashboardTool) {
  registry[tool.id] = tool;
}

/**
 * Retrieve the current tool registry.
 */
export function getTools() {
  return registry;
}

/**
 * Factory to wrap tool page content with common layout elements.
 */
export function createToolPage(
  title: string,
  Content: ComponentType<any>
): ComponentType<any> {
  return function ToolPage(props: any) {
    return (
      <section className="p-6 space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <Content {...props} />
      </section>
    );
  };
}
