import React, { useState, useMemo } from 'react';
import { dashboardColorClasses } from '@/styles/theme';
import {
  Camera,
  FolderOpen,
  Video,
  Activity,
  UserCheck,
  Eye,
} from 'lucide-react';

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
export const dashboardTools: DashboardTool[] = [
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
    status: 'idle',
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
    status: 'idle',
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
    status: 'idle',
  },
  {
    id: 'explorer',
    href: '/dashboard/explorer',
    title: 'File Explorer',
    icon: Eye,
    color: dashboardColorClasses['explorer'],
    context: 'archive',
    relatedTools: ['dam-explorer'],
    lastUsed: '2024-01-17T11:20:00Z',
    status: 'idle',
  },
];

/**
 * Hook to group tools into primary/secondary/tertiary based on status & recency.
 */
export function useIntelligentLayout(tools: DashboardTool[]) {
  const [focusedTool, setFocusedTool] = useState<string | null>(null);
  const [userIntent, setUserIntent] = useState<'browse'|'work'|'analyze'>('browse');

  const layoutGroups = useMemo(() => {
    type Groups = {
      primary: DashboardTool[];
      secondary: DashboardTool[];
      tertiary: DashboardTool[];
    };

    // 1) sort by active first, then by lastUsed desc
    const sorted = [...tools].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });

    // 2) pick top-2 as primary
    const primary = sorted.slice(0, 2);

    // 3) collect all related IDs
    const primaryIds = new Set(primary.map(t => t.id));
    const relatedIds = new Set<string>();
    primary.forEach(t => t.relatedTools.forEach(r => relatedIds.add(r)));

    // 4) secondary = those in relatedIds but not primary
    const secondary = sorted.filter(t => !primaryIds.has(t.id) && relatedIds.has(t.id));

    // 5) tertiary = everything else
    const tertiary = sorted.filter(t => !primaryIds.has(t.id) && !relatedIds.has(t.id));

    return { primary, secondary, tertiary };
  }, [tools]);

  return { layoutGroups, focusedTool, setFocusedTool, userIntent, setUserIntent };
}