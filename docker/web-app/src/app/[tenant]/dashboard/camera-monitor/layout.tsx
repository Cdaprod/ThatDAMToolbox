'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTenant } from '@/providers/TenantProvider';

export default function CameraMonitorLayout({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      {/* Back button overlays top-left */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href={`/${tenant}/dashboard`}
          className="px-3 py-1 rounded transition-colors duration-200 bg-theme-accent text-theme-primary hover:opacity-90"
        >
          ← Back
        </Link>
      </div>

      {/* Camera UI fills the rest */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}