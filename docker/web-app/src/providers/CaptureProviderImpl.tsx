// /docker/web-app/src/providers/CaptureProviderImpl.tsx
'use client';
import { useState, ReactNode } from 'react';
import { useVideoSocketCtx }   from '@/providers/VideoSocketProvider';
import { CaptureContext }      from './CaptureContext';

export default function CaptureProviderImpl({ children }: { children: ReactNode }) {
  const { sendJSON } = useVideoSocketCtx();
  const [recording, setRec] = useState(false);

  const start = () => { sendJSON({ action: 'start_record' }); setRec(true); };
  const stop  = () => { sendJSON({ action: 'stop_record' }); setRec(false); };

  return (
    <CaptureContext.Provider value={{ recording: recording, start, stop }}>
      {children}
    </CaptureContext.Provider>
  );
}