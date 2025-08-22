/**
 * useOrientation - React hook to track current screen orientation.
 *
 * Example:
 *   const orientation = useOrientation();
 *   // orientation === 'portrait' | 'landscape'
 */
import { useEffect, useState } from 'react';

export type Orientation = 'portrait' | 'landscape';

/**
 * Pure helper to derive orientation from a window-like object.
 */
export function getOrientation(win?: { innerWidth: number; innerHeight: number }): Orientation {
  if (!win) return 'landscape';
  return win.innerWidth > win.innerHeight ? 'landscape' : 'portrait';
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => getOrientation(typeof window !== 'undefined' ? window : undefined));

  useEffect(() => {
    const handle = () => setOrientation(getOrientation(window));
    window.addEventListener('resize', handle);
    window.addEventListener('orientationchange', handle);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, []);

  return orientation;
}

export default useOrientation;
