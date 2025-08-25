import type { SimpleEDL, Sequence, Track, Clip } from './types';

// Convert a SimpleEDL to a Sequence structure
export function edlToSequence(edl: SimpleEDL, assetId: string): Sequence {
  const clips: Clip[] = edl.kept.map(k => ({ assetId, source: k }));
  const track: Track = { kind: 'video', clips, label: 'Video' };
  return {
    id: crypto.randomUUID(),
    title: edl.sourceName.replace(/\.[^.]+$/, '') + ' (Trim Idle)',
    version: 'seq.v1',
    tracks: [track],
    duration: edl.kept.reduce((s, r) => s + (r.end - r.start), 0),
    createdAt: new Date().toISOString(),
    sourceHint: edl.sourceName,
  };
}

