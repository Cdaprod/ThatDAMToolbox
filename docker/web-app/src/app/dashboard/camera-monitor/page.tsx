'use client';

import dynamic from 'next/dynamic';
import CameraMonitor from '@/components/CameraMonitor';

/* 👉  Lazy-load CaptureProvider so recording code isn’t in the main bundle */
const CaptureProvider = dynamic(
  () => import('@/providers/CaptureProviderImpl'),
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