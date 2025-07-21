//components/Sidebar.tsx
'use client';

import Link from 'next/link';

const cards = [
  { label: 'Explorer', route: '/dashboard/explorer' },
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
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="font-bold text-lg px-6 py-4 border-b border-gray-700">
        DAM Toolbox
      </div>
      <nav className="flex-1 py-2 px-4 space-y-1">
        {cards.map(card => (
          <Link key={card.route} href={card.route}
            className="block px-3 py-2 rounded hover:bg-gray-800">
            {card.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}