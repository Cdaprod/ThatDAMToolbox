// src/app/dashboard/camera-monitor/page.tsx
'use client';

import dynamic from 'next/dynamic';
import CameraMonitor from '@components/CameraMonitor';

/* lazy-load the merged CaptureProvider so it doesn’t end up in your
   main bundle (and you don’t need CaptureProviderImpl anymore) */
const CaptureProvider = dynamic(
  () =>
    import('@/providers/CaptureProvider').then((m) => ({
      default: m.default ?? (m as any).CaptureProvider ?? (() => null),
    })),
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
