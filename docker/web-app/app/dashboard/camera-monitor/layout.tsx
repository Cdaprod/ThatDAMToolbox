// /app/dashboard/camera-monitor/layout.tsx
'use client'
import Link from 'next/link'

export default function CameraMonitorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      {/* optional back button */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href="/dashboard"
          className="text-white bg-gray-800 px-3 py-1 rounded hover:bg-gray-700 transition"
        >
          ← Back
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}