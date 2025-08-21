import { dashboardColorClasses } from '../styles/theme';
import { Camera, FolderOpen, Video, Activity, UserCheck, Eye, Server, Scissors } from 'lucide-react';
import { createTool, registerTool, getTools, DashboardTool } from '../lib/toolRegistry';

const tools: Parameters<typeof createTool>[0][] = [
  { id: 'nodes', href: '/dashboard/nodes', title: 'Nodes', icon: Server, color: dashboardColorClasses['nodes'], context: 'cluster', relatedTools: [] },
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
    id: 'motion',
    href: '/dashboard/motion',
    title: 'Motion Tool',
    icon: Activity,
    color: dashboardColorClasses['motion'],
    context: 'analysis',
    relatedTools: ['dam-explorer', 'witness'],
    lastUsed: '2024-01-19T16:20:00Z',
  },
  {
    id: 'live',
    href: '/dashboard/live',
    title: 'Live Monitor',
    icon: Video,
    color: dashboardColorClasses['live'],
    context: 'live',
    relatedTools: ['camera-monitor', 'witness'],
    lastUsed: '2024-01-20T08:45:00Z',
    status: 'processing',
  },
  {
    id: 'witness',
    href: '/dashboard/witness',
    title: 'Witness Tool',
    icon: UserCheck,
    color: dashboardColorClasses['witness'],
    context: 'security',
    relatedTools: ['motion', 'live'],
    lastUsed: '2024-01-18T14:30:00Z',
  },
  {
    id: 'ffmpeg',
    href: '/dashboard/ffmpeg',
    title: 'FFmpeg Console',
    icon: Activity,
    color: dashboardColorClasses['motion'],
    context: 'analysis',
    relatedTools: ['motion'],
    lastUsed: '2024-01-16T12:00:00Z',
  },
  {
    id: 'trim-idle',
    href: '/dashboard/trim-idle',
    title: 'Trim Idle',
    icon: Scissors,
    color: dashboardColorClasses['trim-idle'],
    context: 'analysis',
    relatedTools: ['dam-explorer'],
  },
];

tools.forEach(tool => registerTool(createTool(tool)));

export type { DashboardTool };
export const dashboardTools: Record<string, DashboardTool> = getTools();
