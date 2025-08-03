// docker/web-app/src/components/overlays/WaveformMonitor.tsx
import React, { useRef, useEffect } from 'react';

interface Props {
  source: HTMLImageElement | null;
  width: number;
  height: number;
  enabled: boolean;
}

const WaveformMonitor: React.FC<Props> = ({ source, width, height, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  useEffect(() => {
    if (!enabled || !source) return;
    const ctxOff = offscreen.current.getContext('2d')!;
    offscreen.current.width = source.naturalWidth;
    offscreen.current.height = source.naturalHeight;
    const ctx = canvasRef.current!.getContext('2d')!;

    const draw = () => {
      if (!enabled || !source) return;
      ctxOff.drawImage(source, 0, 0);
      const img = ctxOff.getImageData(0, 0, source.naturalWidth, source.naturalHeight).data;

      // compute per-column average luminance
      const cols = source.naturalWidth;
      const rows = source.naturalHeight;
      const waveform = new Float32Array(cols);
      for (let x = 0; x < cols; x++) {
        let sum = 0;
        for (let y = 0; y < rows; y++) {
          const idx = (y * cols + x) * 4;
          sum += 0.299 * img[idx] + 0.587 * img[idx+1] + 0.114 * img[idx+2];
        }
        waveform[x] = sum / rows;
      }
      const max = Math.max(...waveform);

      // draw polyline
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      waveform.forEach((l, x) => {
        const px = (x / cols) * width;
        const py = height - (l / max) * height;
        x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 1;
      ctx.stroke();

      requestAnimationFrame(draw);
    };

    draw();
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

export default WaveformMonitor;