// components/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const cards = [
  { label: 'Explorer', route: '/dashboard/explorer' },
  { label: 'DAM Explorer', route: '/dashboard/dam-explorer' },       // NEW
  { label: 'Camera Monitor', route: '/dashboard/camera-monitor' },   // NEW
  { label: 'Upload', route: '/dashboard/upload' },
  { label: 'Batches', route: '/dashboard/batches' },
  { label: 'Videos', route: '/dashboard/videos' },
  { label: 'Motion', route: '/dashboard/motion' },
  { label: 'Live', route: '/dashboard/live' },
  { label: 'Witness', route: '/dashboard/witness' },
  { label: 'Search', route: '/dashboard/search' },
  { label: 'Batch Ops', route: '/dashboard/batch-ops' },
  { label: 'FFmpeg', route: '/dashboard/ffmpeg' },
  { label: 'Library', route: '/dashboard/library' },
  { label: 'Analytics', route: '/dashboard/analytics' },
];

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 bg-gray-900 text-gray-200 flex flex-col">
      <div className="px-6 py-4 text-2xl font-bold border-b border-gray-700">
        DAM Toolbox
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map(i => (
          <Link
            key={i.href}
            href={i.href}
            className={`
              block px-3 py-2 rounded
              ${path === i.href 
                 ? 'bg-gray-800 text-white' 
                 : 'hover:bg-gray-700'}
              transition`}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}