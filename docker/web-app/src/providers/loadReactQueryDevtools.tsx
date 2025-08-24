'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * React Query Devtools wrapper.
 *
 * Example:
 *   import LoadReactQueryDevtools from '@/providers/loadReactQueryDevtools'
 *   <LoadReactQueryDevtools />
 */

const DEV = process.env.NODE_ENV === 'development';
const Enabled =
  DEV &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== '0' &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== 'false';

export const ReactQueryDevtools: ComponentType<any> = Enabled
  ? dynamic(
      () =>
        import('@tanstack/react-query-devtools').then(
          (m) => m.ReactQueryDevtools ?? m.default
        ),
      { ssr: false }
    )
  : (() => null) as ComponentType<any>;

export default function LoadReactQueryDevtools() {
  if (!Enabled) return null;
  return <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />;
}

