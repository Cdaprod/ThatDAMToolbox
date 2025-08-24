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
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }
    return { default: comp };
  };

  // IMPORTANT: options must be an object literal for Next.js static analysis
  const Dyn: any = dynamic(wrapped as any, {
    ssr: (opts as any)?.ssr,
    loading: (opts as any)?.loading,
    suspense: (opts as any)?.suspense,
  } as any);

  if (process.env.NODE_ENV === 'test') {
    Dyn.__loader = wrapped;
  }
  return Dyn;
}