// /docker/web-app/src/providers/CaptureProvider.tsx
'use client';
import { createContext, useContext, useState } from 'react';
import { useVideoSocketCtx } from '@/context/VideoSocketContext';
import { CaptureContext }    from './CaptureContext';

interface CaptureCtx {
  recording: boolean;
  start(): void;
  stop(): void;
}

const Ctx = createContext<CaptureCtx | null>(null);
export const useCapture = () => useContext(Ctx)!;

export default function CaptureProvider({ children }: { children: React.ReactNode }) {
  const { sendJSON } = useVideoSocketCtx();
  const [recording, setRec] = useState(false);

  return (
    <Ctx.Provider
      value={{
        recording,
        start: () => {
          sendJSON({ action: 'start_record' });
          setRec(true);
        },
        stop: () => {
          sendJSON({ action: 'stop_record' });
          setRec(false);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}