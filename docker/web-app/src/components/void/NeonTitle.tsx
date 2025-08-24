'use client';

import { useEffect, useRef } from 'react';

/**
 * Neon title and subtitle that fade in on mount.
 */
export default function NeonTitle({
  title = 'THATDAMTOOLBOX',
  subtitle = 'Sign in to continue',
}: { title?: string; subtitle?: string }) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    titleRef.current?.classList.add('neon-on');
    subRef.current?.classList.add('neon-subtle-on');
  }, []);

  return (
    <div style={{ textAlign: 'center', pointerEvents: 'auto' }}>
      <h1
        ref={titleRef}
        className="neon"
        style={{
          fontWeight: 800,
          letterSpacing: '0.18em',
          fontSize: 'clamp(28px, 6vw, 56px)',
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      <p
        ref={subRef}
        className="neon-subtle"
        style={{ marginTop: 6, fontSize: 14, opacity: 0.75 }}
      >
        {subtitle}
      </p>
    </div>
  );
}

