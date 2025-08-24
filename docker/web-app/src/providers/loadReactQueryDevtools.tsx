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
  DEV &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== '0' &&
  process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS !== 'false';

/**
 * Select the React Query devtools component from a module, falling back to a
 * harmless no-op component when the expected export is missing.
 */
export function pickDevtools(m: any) {
  return {
    default: m.ReactQueryDevtools ?? m.default ?? (() => null),
  } as { default: ComponentType<any> };
}

export const ReactQueryDevtools: ComponentType<any> = Enabled
  ? dynamic(
      () =>
        import('@tanstack/react-query-devtools').then(pickDevtools),
      { ssr: false }
    )
  : (() => null) as ComponentType<any>;

export default function LoadReactQueryDevtools() {
  if (!Enabled) return null;
  return <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />;
}

