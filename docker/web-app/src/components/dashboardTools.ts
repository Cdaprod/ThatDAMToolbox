// /docker/web-app/src/components/dashboardTools.ts
import {
  FaFolderOpen,
  FaVideo,
  FaRunning,
  FaUserSecret,
  FaCamera,
  FaStream,
} from 'react-icons/fa';

/** Item used by both Sidebar and Dashboard card grid */
export const dashboardTools = [
  {
    href: '/dashboard/camera-monitor',
    title: 'Camera Monitor',
    icon: FaCamera,
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    href: '/dashboard/dam-explorer',
    title: 'DAM Explorer',
    icon: FaFolderOpen,
    color: 'from-purple-500 to-purple-600',
  },
  {
    href: '/dashboard/explorer',
    title: 'File Explorer',
    icon: FaFolderOpen,
    color: 'from-blue-500 to-blue-600',
  },
  {
    href: '/dashboard/motion',
    title: 'Motion Tool',
    icon: FaRunning,
    color: 'from-pink-500 to-pink-600',
  },
  {
    href: '/dashboard/live',
    title: 'Live Monitor',
    icon: FaVideo,
    color: 'from-green-500 to-green-600',
  },
  {
    href: '/dashboard/witness',
    title: 'Witness Tool',
    icon: FaUserSecret,
    color: 'from-yellow-500 to-yellow-600',
  },
] as const;