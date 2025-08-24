'use client';

import dynamic, { DynamicOptions } from 'next/dynamic';

/**
 * Wraps `next/dynamic` and logs a helpful error if the loader does not
 * resolve to a React component.
 *
 * Example:
 *   const MyComp = safeDynamic(() => import('./MyComp'), { ssr: false });
 *   <MyComp />
 */

type Loader<T> = () => Promise<T>;

export default function safeDynamic<TModule extends Record<string, any>>(
  loader: Loader<TModule>,
  opts?: DynamicOptions<Record<string, unknown>>
) {
  const wrapped = async () => {
    const mod = await loader();
    const comp =
      (mod as any).default ??
      (mod as any).Component ??
      (mod as any).ReactComponent;

    if (process.env.NODE_ENV !== 'production') {
      if (typeof comp !== 'function') {
        const err = new Error(
          '[safeDynamic] loader did not return a React component. ' +
            'Make sure the target file exports a default component.\n' +
            'Resolved keys: ' + Object.keys(mod || {}).join(', ')
        );
        console.error(err);
      }
    }
    return { default: comp };
  };

  const DynamicComponent: any = dynamic(wrapped as any, opts);
  if (process.env.NODE_ENV === 'test') {
    DynamicComponent.__loader = wrapped;
  }
  return DynamicComponent;
}

