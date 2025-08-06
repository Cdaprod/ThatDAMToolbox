// /docker/web-app/src/app/dashboard/page.tsx
'use client';

import useSWR from 'swr'
import { dashboardTools } from '@/components/dashboardTools'
import ToolCard from '@/components/ToolCard'

interface ApiStats {
  assets: number
  countBytes: number
}

export default function DashboardMain() {
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data } = useSWR<ApiStats>('/api/library/stats', fetcher, {
    fallbackData: { assets: 0, countBytes: 0 },
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ────── live stats card ────── */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-lg mb-2">📊 Library Stats</h2>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <li>
            <span className="font-semibold text-gray-700">{data?.assets}</span>
            <br />assets
          </li>
          <li>
            <span className="font-semibold text-gray-700">
              {(data?.countBytes / 1_000_000_000).toFixed(1)} GB
            </span>
            <br />disk usage
          </li>
        </ul>
      </section>

      {/* ────── existing tool grid ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardTools.map(({ href }) => (
          <ToolCard key={href} href={href} />
        ))}
      </div>
    </div>
  );
}