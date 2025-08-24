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
  return win.innerHeight >= win.innerWidth ? 'portrait' : 'landscape';
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  useEffect(() => {
    const calc = () => getOrientation(window);
    const onResize = () => setOrientation(calc());
    setOrientation(calc());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return orientation;
}

export default useOrientation;
