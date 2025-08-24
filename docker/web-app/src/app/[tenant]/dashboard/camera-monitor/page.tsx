// src/app/dashboard/camera-monitor/page.tsx
'use client';

import safeDynamic from '@/lib/safeDynamic';
import CameraMonitor from '@components/CameraMonitor';

/* lazy-load the merged CaptureProvider so it doesn’t end up in your
   main bundle (and you don’t need CaptureProviderImpl anymore) */
const CaptureProvider = safeDynamic(
  () => import('@/providers/CaptureProvider'),
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
