/**
 * useVideoBox - compute letterboxed size for a video element inside its parent container.
 * Ensures video never overflows and preserves aspect ratio.
 *
 * Example:
 * ```tsx
 * const ref = useRef<HTMLVideoElement>(null);
 * const box = useVideoBox(ref);
 * return <video ref={ref} style={{ width: box.width, height: box.height }} />
 * ```
 */
import { useState, useEffect, RefObject } from 'react';
import fitRect from '../lib/fitRect';

export interface VideoBox { width: number; height: number }

export default function useVideoBox(ref: RefObject<HTMLVideoElement>): VideoBox {
  const [box, setBox] = useState<VideoBox>({ width: 0, height: 0 });

  useEffect(() => {
    const video = ref.current;
    const container = video?.parentElement;
    if (!video || !container || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const vw = video.videoWidth || cw;
      const vh = video.videoHeight || ch;
      setBox(fitRect({ width: cw, height: ch }, { width: vw, height: vh }));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    video.addEventListener('loadedmetadata', update);
    return () => {
      ro.disconnect();
      video.removeEventListener('loadedmetadata', update);
    };
  }, [ref]);

  return box;
}
