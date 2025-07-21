'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react'
import DAMApp from '../components/DAMApp';
import { FaTachometerAlt, FaFolderOpen, FaRunning, FaVideo, FaUserSecret, FaColumns } from 'react-icons/fa';

export default function Page() {
  const [status, setStatus] = useState<{ status?: string }>({})

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error)
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-12 px-4">
      <h1 className="text-4xl font-extrabold mb-2 tracking-tight flex items-center gap-3">
        <span role="img" aria-label="clapperboard">🎬</span>
        Video Dashboard
      </h1>
      <pre className="bg-gray-200 text-gray-800 rounded-md px-4 py-2 mb-6 w-full max-w-xl text-sm shadow-inner">
        {JSON.stringify(status, null, 2)}
      </pre>
      <section className="w-full max-w-3xl mb-12">
        <DAMApp />
      </section>

      {/* Navigation Shortcuts */}
      <nav className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
        >
          <FaTachometerAlt />
          Dashboard
        </Link>
        <Link
          href="/dashboard/explorer"
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 transition"
        >
          <FaFolderOpen />
          Explorer
        </Link>
        <Link
          href="/dashboard/motion"
          className="flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg shadow hover:bg-pink-700 transition"
        >
          <FaRunning />
          Motion Tool
        </Link>
        <Link
          href="/dashboard/live"
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
        >
          <FaVideo />
          Live Monitor
        </Link>
        <Link
          href="/dashboard/witness"
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg shadow hover:bg-yellow-700 transition"
        >
          <FaUserSecret />
          Witness Tool
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg shadow hover:bg-gray-800 transition"
        >
          <FaColumns />
          Full Dashboard
        </Link>
      </nav>
    </main>
  )
}