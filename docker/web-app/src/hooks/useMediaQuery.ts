'use client';
import { useEffect, useState } from 'react';

/**
 * useMediaQuery – evaluate a CSS media query in a React-friendly, SSR-safe way.
 *
 * Example:
 *   const isNarrow = useMediaQuery('(max-width: 600px)', false);
 */
export function useMediaQuery(query: string, ssrMatch = false): boolean {
  const [matches, setMatches] = useState<boolean>(ssrMatch);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, [query]);

  return matches;
}
