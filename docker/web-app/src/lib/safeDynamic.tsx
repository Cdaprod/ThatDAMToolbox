// /docker/web-app/src/lib/safeDynamic.tsx
'use client';

import React, { type ComponentType } from 'react';
import dynamic, { type DynamicOptions } from 'next/dynamic';

const Noop: ComponentType<any> = () => null;

/**
 * Wraps next/dynamic and guarantees a valid component is returned.
 * If loader resolves to a non-component or throws, we fall back to Noop.
 */
export default function safeDynamic<TModule extends Record<string, any>>(
  loader: () => Promise<TModule>,
  opts?: DynamicOptions<Record<string, unknown>>
) {
  const wrapped = async () => {
    let mod: any = {};
    try {
      mod = await loader();
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[safeDynamic] loader threw:', err?.message || err);
      }
      // fall through with empty module
    }

    let comp =
      mod?.default ?? mod?.Component ?? mod?.ReactComponent;

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

    return { default: comp as ComponentType<any> };
  };

  // IMPORTANT: options object must be an inline literal.
  const DynamicComponent: any = dynamic(wrapped as any, {
    ssr: opts?.ssr ?? false,
    loading: (opts?.loading as any) ?? (() => null),
    // Add more allowed literal keys here only if you actually use them
    // suspense: opts?.suspense,
    // revalidate: (opts as any)?.revalidate,
  });

  if (process.env.NODE_ENV === 'test') {
    (DynamicComponent as any).__loader = wrapped;
  }

  return DynamicComponent as ComponentType<any>;
}