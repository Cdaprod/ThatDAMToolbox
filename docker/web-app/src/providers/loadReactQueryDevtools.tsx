'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * React Query Devtools wrapper that is safe even when the package is missing.
 *
 * Usage:
 *   import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools'
 *   <LoadReactQueryDevtools />
 */

const DEV = process.env.NODE_ENV === 'development';
const Enabled =
  DEV &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== '0' &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== 'false';

const Noop: ComponentType<any> = () => null;

export const ReactQueryDevtools: ComponentType<any> = Enabled
  ? dynamic(
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
    )
  : Noop;

export default function LoadReactQueryDevtools() {
  if (!Enabled) return null;
  return <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />;
}