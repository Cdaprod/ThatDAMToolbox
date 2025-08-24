/**
 * useOrientationAspect - track device orientation and the aspect ratio of a referenced element.
 *
 * Example:
 * ```tsx
 * const ref = useRef<HTMLVideoElement>(null);
 * const { orientation, aspect } = useOrientationAspect(ref);
 * ```
 */
import { useState, useEffect, RefObject } from 'react';
import { useOrientation, Orientation } from './useOrientation';

export interface OrientationAspect {
  orientation: Orientation;
  aspect: number | null;
}

/**
 * Pure helper that calculates an aspect ratio from a rect-like object.
 */
export function getAspect(rect: { width: number; height: number }): number | null {
  if (!rect.width || !rect.height) return null;
  return rect.width / rect.height;
}

export default function useOrientationAspect<T extends HTMLElement>(
  ref: RefObject<T>
): OrientationAspect {
  const orientation = useOrientation();
  const [aspect, setAspect] = useState<number | null>(16 / 9);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setAspect(getAspect(rect));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return { orientation, aspect };
}
