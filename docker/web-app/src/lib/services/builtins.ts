// Register built-in service implementations
import { registerPlugin } from './plugins';
import { AppConfig } from '../config';

// Local motion analyzer using in-browser implementation
registerPlugin({
  name: 'builtin-local-analyzer',
  provides: ['video.analyze.motion'],
  impl: {
    async analyzeMotion(url: string, opts: { thresholdPct: number; minIdleMs: number; fps: number }) {
      const { analyzeMotionURL } = await import('../workers/adapters');
      return analyzeMotionURL(url, opts);
    },
  },
});

// Remote render via media-api when configured
registerPlugin({
  name: 'builtin-remote-render',
  provides: ['sequence.render'],
  impl: {
    async renderSequence(file: File, sequence: any): Promise<Blob> {
      if (!AppConfig.mediaApiBase) throw new Error('media-api not configured');
      const form = new FormData();
      form.append('file', file);
      form.append('sequence', new Blob([JSON.stringify(sequence)], { type: 'application/json' }), 'sequence.json');
      const res = await fetch(`${AppConfig.mediaApiBase}/render/sequence`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`media-api render failed: ${res.status}`);
      return await res.blob();
    },
  },
});

