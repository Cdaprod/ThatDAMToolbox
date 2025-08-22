// src/app/dashboard/camera-monitor/page.tsx
'use client'

import { Suspense } from 'react'
import CameraMonitorLoading from './loading'
import CameraMonitor from '@components/CameraMonitor'

export default function CameraMonitorPage() {
  return (
    <Suspense fallback={<CameraMonitorLoading />}>
      <CameraMonitorContent />
    </Suspense>
  )
}

// Example split to ensure only inner content suspends
function CameraMonitorContent() {
  return (
    <div className="w-full h-full">
      <CameraMonitor />
    </div>
  )
}