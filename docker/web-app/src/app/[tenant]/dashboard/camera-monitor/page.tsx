// src/app/dashboard/camera-monitor/page.tsx
'use client';

import safeDynamic from '@/lib/safeDynamic';

const CaptureProvider = safeDynamic(
  () => import('@/providers/CaptureProvider'),
  { ssr: false }
);

const CameraMonitor = safeDynamic(
  () => import('@components/CameraMonitor'),
  { ssr: false }
);

export default function CameraMonitorPage() {
  return (
    <CaptureProvider>
      <div className="w-full h-full">
        <CameraMonitor />
      </div>
    </CaptureProvider>
  );
}
