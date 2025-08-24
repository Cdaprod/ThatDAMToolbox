// /docker/web-app/src/lib/safeDynamic.tsx
'use client';

import React, { type ComponentType } from 'react';
import dynamic, { type DynamicOptions } from 'next/dynamic';

/**
 * Wraps next/dynamic and guarantees a real component is returned.
 * If the loaded module doesn't export a component, we fall back to Noop.
 *
 * Usage:
 *   const Widget = safeDynamic(() => import('./Widget'), { ssr: false });
 *   <Widget />
 */

type Loader<T> = () => Promise<T>;
const Noop: ComponentType<any> = () => null;

export default function safeDynamic<TModule extends Record<string, any>>(
  loader: Loader<TModule>,
  opts?: DynamicOptions<Record<string, unknown>>
) {
  // The wrapped loader Next will call
  const wrapped = async () => {
    const mod = await loader().catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[safeDynamic] loader threw:', err?.message || err);
      }
      return {} as TModule;
    });

    let comp: any =
      (mod as any)?.default ??
      (mod as any)?.Component ??
      (mod as any)?.ReactComponent;

    if (typeof comp !== 'function') {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(
          '[safeDynamic] loader did not return a React component. ' +
            'Resolved keys: ' + Object.keys(mod || {}).join(', ') +
            ' -- falling back to Noop.'
        );
      }
      comp = Noop;
    }

    // Next expects a module-like object with a default component
    return { default: comp } as { default: ComponentType<any> };
  };

  // IMPORTANT: Next requires an object-literal options arg.
  const options: DynamicOptions<Record<string, unknown>> = opts ? { ...opts } : {};

  const DynamicComponent: any = dynamic(wrapped as any, options);

  // Handy in tests
  if (process.env.NODE_ENV === 'test') {
    DynamicComponent.__loader = wrapped;
  }

  return DynamicComponent as ComponentType<any>;
}