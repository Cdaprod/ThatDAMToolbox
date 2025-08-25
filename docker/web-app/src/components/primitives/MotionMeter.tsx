'use client';

import { useMemo } from 'react';

export default function MotionMeter({
  samples,
  height = 24,
  className = '',
  title = 'motion %',
}: {
  samples: number[];
  height?: number;
  className?: string;
  title?: string;
}) {
  const path = useMemo(() => {
    if (!samples?.length) return '';
    const w = Math.max(80, samples.length);
    const h = height;
    const d = samples
      .map((v, i) => {
        const x = (i / (samples.length - 1)) * w;
        const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { d, w, h };
  }, [samples, height]);

  if (!samples?.length) {
    return <div className={`text-xs text-zinc-400 ${className}`}>no motion data</div>;
  }
  return (
    <div className={className} title={title}>
      <svg width={path.w} height={path.h} viewBox={`0 0 ${path.w} ${path.h}`}>
        <rect x="0" y="0" width={path.w} height={path.h} fill="currentColor" opacity="0.08" />
        <path d={path.d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
