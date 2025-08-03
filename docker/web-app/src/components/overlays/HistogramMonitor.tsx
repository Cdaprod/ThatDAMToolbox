// docker/web-app/src/components/overlays/HistogramMonitor.tsx
import React, { useRef, useEffect } from 'react';

interface Props {
  source: HTMLImageElement | null;
  width: number;
  height: number;
  enabled: boolean;
}

const HistogramMonitor: React.FC<Props> = ({ source, width, height, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  useEffect(() => {
    if (!enabled || !source) return;
    const ctxOff = offscreen.current.getContext('2d')!;
    offscreen.current.width = source.naturalWidth;
    offscreen.current.height = source.naturalHeight;

    const ctx = canvasRef.current!.getContext('2d')!;
    const buckets = new Uint32Array(256);

    const draw = () => {
      if (!enabled || !source) return;
      // draw current frame into offscreen
      ctxOff.drawImage(source, 0, 0);
      const img = ctxOff.getImageData(0, 0, source.naturalWidth, source.naturalHeight).data;
      buckets.fill(0);
      // compute luminance histogram
      for (let i = 0; i < img.length; i += 4) {
        const lum = Math.floor(0.299 * img[i] + 0.587 * img[i+1] + 0.114 * img[i+2]);
        buckets[lum]++;
      }
      const max = Math.max(...buckets);

      // clear & draw bars
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const barW = width / 256;
      for (let i = 0; i < 256; i++) {
        const h = (buckets[i] / max) * height;
        ctx.fillRect(i * barW, height - h, barW, h);
      }
      requestAnimationFrame(draw);
    };

    draw();
    return () => { /* optional cleanup */ };
  }, [enabled, source, width, height]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block mx-auto"
      style={{ background: 'black' }}
    />
  );
};

export default HistogramMonitor;