'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * React Query Devtools wrapper that is safe even when the package is missing
 * and avoids popup errors on mobile devices.
 *
 * Usage:
 *   import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools'
 *   <LoadReactQueryDevtools />
 */

const Noop: ComponentType<any> = () => null;

/**
 * Determines whether React Query Devtools should be enabled. Mobile user
 * agents are always disabled to avoid popup failures.
 */
export function shouldEnableDevtools(): boolean {
  const DEV = process.env.NODE_ENV === 'development';
  if (!DEV) return false;
  const flag = process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS;
  if (flag === '0' || flag === 'false') return false;
  if (typeof navigator !== 'undefined') {
    return !/Mobi|Android|iP(hone|ad|od)/i.test(navigator.userAgent);
  }
  return true;
}

export default function LoadReactQueryDevtools() {
  if (!shouldEnableDevtools()) return null;
  const ReactQueryDevtools: ComponentType<any> = dynamic(
    async () => {
      try {
        const m = await import('@tanstack/react-query-devtools');
        // Always return a real component
        return (m as any).ReactQueryDevtools ?? (m as any).default ?? Noop;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ReactQueryDevtools] disabled (load failed):',
          (err as Error)?.message || err
        );
        return Noop;
      }
    },
    { ssr: false }
  );
  return <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />;
}

export { Noop as ReactQueryDevtools };