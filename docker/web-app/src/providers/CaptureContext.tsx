// /docker/web-app/src/providers/CaptureContext.tsx
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

export const useCapture = () => useContext(CaptureContext);