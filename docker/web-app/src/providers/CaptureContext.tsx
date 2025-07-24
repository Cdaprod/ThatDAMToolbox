// src/providers/CaptureContext.tsx
'use client';
import { createContext, useContext } from 'react';

export interface CaptureCtx {
  recording: boolean;
  start(): void;
  stop(): void;
}

export const CaptureContext = createContext<CaptureCtx>({
  recording: false,
  start : () => console.warn('Capture context not ready'),
  stop  : () => console.warn('Capture context not ready'),
});

export const useCapture = () => {
  const ctx = useContext(CaptureContext);
  if (!ctx) {
    throw new Error('useCapture must be inside a <CaptureProvider>');
  }
  return ctx;
};