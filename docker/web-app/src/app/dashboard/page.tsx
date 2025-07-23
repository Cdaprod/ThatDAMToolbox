// /docker/web-app/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { stats } from '@/lib/video';                // ← wrapper we built
import { dashboardTools } from '@/components/dashboardTools';
import ToolCard from '@/components/ToolCard';

type ApiStats = {
  files: number;
  batches: number;
  duration_sec: number;
  total_bytes: number;
  // …anything else your /stats endpoint returns
};

export default function DashboardMain() {
  const [info, setInfo] = useState<ApiStats | null>(null);
  const [err, setErr]   = useState<string | null>(null);

  useEffect(() => {
    stats()
      .then(setInfo)
      .catch(e => setErr(e.message));
  }, []);

  return (
    <div className="space-y-6">
      {/* ────── live stats card ────── */}
      <section className="rounded-lg bg-white shadow p-6 border border-gray-200">
        <h2 className="font-bold text-lg mb-2">📊 Library Stats</h2>
        {err && <p className="text-red-600 text-sm">{err}</p>}

        {!info && !err && (
          <p className="text-gray-500 text-sm">Fetching…</p>
        )}

        {info && (
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <li>
              <span className="font-semibold text-gray-700">{info.files}</span>
              <br />files
            </li>
            <li>
              <span className="font-semibold text-gray-700">{info.batches}</span>
              <br />batches
            </li>
            <li>
              <span className="font-semibold text-gray-700">
                {(info.duration_sec / 3600).toFixed(1)} h
              </span>
              <br />total duration
            </li>
            <li>
              <span className="font-semibold text-gray-700">
                {(info.total_bytes / 1_000_000_000).toFixed(1)} GB
              </span>
              <br />disk usage
            </li>
          </ul>
        )}
      </section>

      {/* ────── existing tool grid ────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {dashboardTools.map(({ href }) => (
          <ToolCard key={href} href={href} />
        ))}
      </div>
    </div>
  );
}