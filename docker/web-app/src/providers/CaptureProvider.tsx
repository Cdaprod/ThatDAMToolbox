// src/providers/CaptureProvider.tsx
'use client';

import React, { ReactNode, useState } from 'react';
import { useVideoSocketCtx } from './VideoSocketProvider';
import { CaptureContext }   from './CaptureContext';    // ← import, don’t recreate

export default function CaptureProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { sendJSON } = useVideoSocketCtx();
  const [recording, setRecording] = useState(false);

  const start = () => {
    sendJSON({ action: 'start_record' });
    setRecording(true);
  };

  const stop = () => {
    sendJSON({ action: 'stop_record' });
    setRecording(false);
  };

  return (
    <CaptureContext.Provider value={{ recording, start, stop }}>
      {children}
    </CaptureContext.Provider>
  );
}