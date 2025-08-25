// Frontend service façade selecting implementations via plugins
import { AppConfig } from '../config';
import { can } from './policy';
import { find } from './plugins';
import './builtins';

export const Services = {
  async analyzeMotion(url: string, opts: { thresholdPct: number; minIdleMs: number; fps: number }) {
    if (!(await can('media.analyze'))) throw new Error('Not authorized');
    const local = find('video.analyze.motion');
    if (local) return local.impl.analyzeMotion(url, opts);
    throw new Error('No analyzer plugin available');
  },

  async renderSequence(file: File, sequence: any): Promise<Blob> {
    if (!(await can('media.render'))) throw new Error('Not authorized');
    const remote = AppConfig.mediaApiBase && find('sequence.render');
    if (remote) return remote.impl.renderSequence(file, sequence);
    const form = new FormData();
    form.append('file', file);
    form.append('sequence', new Blob([JSON.stringify(sequence)], { type: 'application/json' }), 'sequence.json');
    const res = await fetch('/api/video/render-sequence', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`render stub failed: ${res.status}`);
    return await res.blob();
  },
};

