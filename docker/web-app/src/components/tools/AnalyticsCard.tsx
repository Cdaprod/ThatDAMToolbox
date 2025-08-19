'use client'

import { useEffect, useState } from 'react'

interface ApiStats {
  assets: number
  countBytes: number
}

/** Dashboard card showing library statistics */
export default function AnalyticsCard() {
  const [data, setData] = useState<ApiStats>({ assets: 0, countBytes: 0 })

  useEffect(() => {
    fetch('/api/library/stats')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-bold text-lg mb-2">📊 Library Stats</h2>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <li>
          <span className="font-semibold text-gray-700">{data.assets}</span>
          <br />assets
        </li>
        <li>
          <span className="font-semibold text-gray-700">
            {(data.countBytes / 1_000_000_000).toFixed(1)} GB
          </span>
          <br />disk usage
        </li>
      </ul>
    </section>
  )
}
