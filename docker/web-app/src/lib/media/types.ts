// Shared media and sequence types

export type MediaID = string;
export type TimeRange = { start: number; end: number };

export type SimpleEDL = {
  version: 'trimidle.v1';
  sourceName: string;
  duration: number;
  kept: TimeRange[];
};

export type Clip = { assetId: MediaID; source: TimeRange; effects?: Record<string, unknown> };
export type Track = { kind: 'video' | 'audio' | 'overlay'; clips: Clip[]; label?: string };
export type Sequence = {
  id: string;
  title?: string;
  version: 'seq.v1';
  tracks: Track[];
  duration?: number;
  createdAt: string;
  updatedAt?: string;
  sourceHint?: string;
};

