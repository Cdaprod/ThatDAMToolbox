import React, { useRef, useEffect } from 'react';

interface Props {
  source: HTMLImageElement | HTMLVideoElement | null;
  width: number;
  height: number;
  enabled: boolean;
}

const HistogramMonitor: React.FC<Props> = ({ source, width, height, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  useEffect(() => {
    if (!enabled || !source) return;

    // determine actual pixel dimensions
    const w = source instanceof HTMLVideoElement
      ? source.videoWidth
      : source.naturalWidth;
    const h = source instanceof HTMLVideoElement
      ? source.videoHeight
      : source.naturalHeight;

    // wait for metadata
    if (w === 0 || h === 0) return;

    offscreen.current.width  = w;
    offscreen.current.height = h;
    const ctxOff  = offscreen.current.getContext('2d')!;
    const ctxMain = canvasRef.current!.getContext('2d')!;
    const buckets = new Uint32Array(256);

    const draw = () => {
      if (!enabled || !source) return;

      // draw into offscreen at integer dims
      ctxOff.drawImage(source, 0, 0, w, h);
      const img = ctxOff.getImageData(0, 0, w, h).data;
      buckets.fill(0);

      // build luminance histogram
      for (let i = 0; i < img.length; i += 4) {
        const lum = Math.floor(
          0.299 * img[i] +
          0.587 * img[i + 1] +
          0.114 * img[i + 2]
        );
        buckets[lum]++;
      }
      const max = Math.max(...buckets);

      // render bars into your canvas box
      ctxMain.clearRect(0, 0, width, height);
      ctxMain.fillStyle = 'rgba(255,255,255,0.6)';
      const barW = width / 256;

      for (let j = 0; j < 256; j++) {
        const barH = (buckets[j] / max) * height;
        ctxMain.fillRect(j * barW, height - barH, barW, barH);
      }

      requestAnimationFrame(draw);
    };

    draw();
    // no special cleanup needed
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