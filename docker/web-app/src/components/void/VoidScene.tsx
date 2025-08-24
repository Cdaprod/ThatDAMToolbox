'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative layered "void" background with subtle parallax.
 * Pointer events pass through; all visual, no interaction.
 */
export default function VoidScene() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inertia = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;

    const step = () => {
      const s = inertia.current;
      s.x += (s.vx - s.x) * 0.06;
      s.y += (s.vy - s.y) * 0.06;
      el.style.setProperty('--mx', s.x.toFixed(3));
      el.style.setProperty('--my', s.y.toFixed(3));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onMove = (e: PointerEvent) => {
      const { innerWidth, innerHeight } = window;
      const nx = (e.clientX / innerWidth - 0.5) * 10;
      const ny = (e.clientY / innerHeight - 0.5) * 10;
      inertia.current.vx = nx;
      inertia.current.vy = ny;
    };
    const onLeave = () => {
      inertia.current.vx = 0;
      inertia.current.vy = 0;
    };

    const onTilt = (e: DeviceOrientationEvent) => {
      if (typeof e.beta !== 'number' || typeof e.gamma !== 'number') return;
      inertia.current.vx = (e.gamma ?? 0) * 0.2;
      inertia.current.vy = (e.beta ?? 0) * 0.1;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onTilt);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <div ref={rootRef} className="void-scene">
      <div className="void-bg" />
      <div className="void-noise" />
      <div className="void-motes" />
      <div className="void-halo" />
    </div>
  );
}

