import { dashboardColorClasses } from '../styles/theme';
import {
  Camera,
  FolderOpen,
  Video,
  Activity,
  UserCheck,
  Eye,
  Server,
  Scissors,
} from 'lucide-react';
import { createTool, registerTool, getTools, DashboardTool } from '../lib/toolRegistry';

/**
 * Merged, de-conflicted tool catalog.
 * - Keeps array form: Parameters<typeof createTool>[0][]
 * - Deduplicates `layered-explorer` (it appeared twice and once as a keyed map)
 * - Preserves/extends relationships + statuses
 * - Adds `trim` tool from "add-tool-card-for-trim-idle-module-*"
 * - Adds lightweight `live` switcher so `camera-monitor.relatedTools` stays valid
 */
const tools: Parameters<typeof createTool>[0][] = [
  {
    id: 'nodes',
    href: '/dashboard/nodes',
    title: 'Nodes',
    icon: Server,
    color: dashboardColorClasses['nodes'],
    context: 'cluster',
    relatedTools: [],
  },
  {
    id: 'camera-monitor',
    href: '/dashboard/camera-monitor',
    title: 'Camera Monitor',
    icon: Camera,
    color: dashboardColorClasses['camera-monitor'],
    context: 'live',
    relatedTools: ['dam-explorer', 'live'],
    lastUsed: '2024-01-20T10:30:00Z',
    status: 'active',
  },
  {
    id: 'dam-explorer',
    href: '/dashboard/dam-explorer',
    title: 'DAM Explorer',
    icon: FolderOpen,
    color: dashboardColorClasses['dam-explorer'],
    context: 'archive',
    relatedTools: ['camera-monitor', 'motion'],
    lastUsed: '2024-01-20T09:15:00Z',
  },
  {
    id: 'layered-explorer',
    href: '/dashboard/layered-explorer',
    title: 'Layered Explorer',
    icon: Eye,
    color: dashboardColorClasses['layered-explorer'],
    context: 'archive',
    relatedTools: ['dam-explorer'],
    lastUsed: '2024-01-20T09:15:00Z',
    status: 'idle',
  },
  {
    id: 'motion',
    href: '/dashboard/motion',
    title: 'Motion Tool',
    icon: Activity,
    color: dashboardColorClasses['motion'],
    context: 'analysis',
    relatedTools: ['dam-explorer', 'camera-monitor'],
    status: 'idle',
  },
  {
    id: 'live',
    href: '/dashboard/live',
    title: 'Live Switcher',
    icon: Video,
    color: dashboardColorClasses['live'],
    context: 'live',
    relatedTools: ['camera-monitor'],
    status: 'idle',
  },
  {
    id: 'trim',
    href: '/dashboard/trim',
    title: 'Trim / Idle Module',
    icon: Scissors,
    color: dashboardColorClasses['trim'],
    context: 'post',
    relatedTools: ['dam-explorer', 'motion'],
    status: 'idle',
  },
  {
    id: 'access',
    href: '/dashboard/access',
    title: 'Access Control',
    icon: UserCheck,
    color: dashboardColorClasses['access'],
    context: 'admin',
    relatedTools: ['nodes'],
    status: 'idle',
  },
];

// Optional: register on import; or call initDashboardTools() from your app bootstrap.
export function initDashboardTools() {
  tools.forEach((t) => registerTool(t));
}

export { tools };
export type { DashboardTool };