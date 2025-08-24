'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * React Query Devtools wrapper that uses a static import so webpack can
 * emit a real chunk. The devtools are tree-shaken from production builds
 * and fall back to a no-op component when disabled.
 *
 * Example:
 *   import { ReactQueryDevtools } from './loadReactQueryDevtools'
 *   <ReactQueryDevtools initialIsOpen={false} />
 */

const DEV = process.env.NODE_ENV === 'development';
const Enabled =
  typeof window !== 'undefined' &&
  DEV &&
  (process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS === '1' ||
    process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS === 'true');

export const ReactQueryDevtools: ComponentType<any> = Enabled
  ? dynamic(
      () =>
        import('@tanstack/react-query-devtools').then(
          (m: any) => m.ReactQueryDevtools ?? m.default ?? (() => null)
        ),
      { ssr: false }
    )
  : (() => null) as ComponentType<any>;

export default function LoadReactQueryDevtools() {
  if (!Enabled) return null;
  try {
    return (
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
      />
    );
  } catch (err: any) {
    console.warn('[ReactQueryDevtools] failed:', err.message);
    return null;
  }
}

