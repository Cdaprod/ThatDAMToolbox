import { dashboardColorClasses } from '../styles/theme';
import { Camera, FolderOpen, Video, Activity, UserCheck, Eye, Server } from 'lucide-react';

/** 
 * A dashboard "tool" with rich metadata for intelligent layout 
 */
export interface DashboardTool {
  id: string;
  href: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  context: string;
  relatedTools: string[];
  lastUsed: string; // ISO timestamp
  status: 'active' | 'processing' | 'idle';
}

/** 
 * Your canonical list of dashboard tools, now with context, recency, status, etc. 
 */
export const dashboardTools: Record<string, DashboardTool> = {
  nodes: {
    id: 'nodes',
    href: '/dashboard/nodes',
    title: 'Nodes',
    icon: Server,
    color: dashboardColorClasses['nodes'],
    context: 'cluster',
    relatedTools: [],
    lastUsed: new Date().toISOString(),
    status: 'idle',
  },
  'camera-monitor': {
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
  'dam-explorer': {
    id: 'dam-explorer',
    href: '/dashboard/dam-explorer',
    title: 'DAM Explorer',
    icon: FolderOpen,
    color: dashboardColorClasses['dam-explorer'],
    context: 'archive',
    relatedTools: ['camera-monitor', 'motion'],
    lastUsed: '2024-01-20T09:15:00Z',
    status: 'idle',
  },
  motion: {
    id: 'motion',
    href: '/dashboard/motion',
    title: 'Motion Tool',
    icon: Activity,
    color: dashboardColorClasses['motion'],
    context: 'analysis',
    relatedTools: ['dam-explorer', 'witness'],
    lastUsed: '2024-01-19T16:20:00Z',
    status: 'idle',
  },
  live: {
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
  witness: {
    id: 'witness',
    href: '/dashboard/witness',
    title: 'Witness Tool',
    icon: UserCheck,
    color: dashboardColorClasses['witness'],
    context: 'security',
    relatedTools: ['motion', 'live'],
    lastUsed: '2024-01-18T14:30:00Z',
    status: 'idle',
  },
  ffmpeg: {
    id: 'ffmpeg',
    href: '/dashboard/ffmpeg',
    title: 'FFmpeg Console',
    icon: Activity,
    color: dashboardColorClasses['motion'],
    context: 'analysis',
    relatedTools: ['motion'],
    lastUsed: '2024-01-16T12:00:00Z',
    status: 'idle',
  },
};
