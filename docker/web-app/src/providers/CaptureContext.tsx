// src/providers/CaptureContext.tsx
'use client';

import { createContext, useContext } from 'react';

export type Codec = 'h264' | 'hevc';

export interface CaptureCtx {
  recording: boolean;
  start(): void;
  stop(): void;

  // live‐stream state:
  selectedDevice: string;
  setSelectedDevice: (device: string) => void;  // ← ADDED
  selectedCodec: Codec;
  setSelectedCodec: (codec: Codec) => void;     // ← ADDED
  deviceInfo: { width: number; height: number; fps: number };

  // timecode
  timecode: string;

  // overlay flags
  overlays: {
    focusPeaking: boolean;
    zebras: boolean;
    falseColor: boolean;
  };

  // histogram buckets
  histogramData: number[];

  // how long we’ve been recording
  recordingTime: number;
}

export const CaptureContext = createContext<CaptureCtx>({
  recording: false,
  start:     () => {},
  stop:      () => {},

  selectedDevice: '',
  setSelectedDevice: () => {},   // ← ADDED
  selectedCodec:  'h264',
  setSelectedCodec: () => {},    // ← ADDED
  deviceInfo:     { width: 0, height: 0, fps: 0 },

  timecode: '00:00:00:00',

  overlays:      { focusPeaking: false, zebras: false, falseColor: false },
  histogramData: [],
  recordingTime: 0,
});

export const useCapture = () => {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be inside a CaptureProvider');
  return ctx;
};