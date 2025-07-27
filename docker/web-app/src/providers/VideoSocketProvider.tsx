// /docker/web-app/src/providers/VideoSocketProvider.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useVideoSocket } from '@lib/useVideoSocket';

interface Ctx {
  sendJSON: (payload: any) => void;
}

const VideoSocketCtx = createContext<Ctx | null>(null);

export default function VideoSocketProvider({ children }: { children: ReactNode }) {
  const { sendJSON } = useVideoSocket(
    process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws,
    {
      onMessage: (ev) => {
        // log for debugging
        console.log('[ws] message', ev.data);
        // 〰 broadcast globally
        window.dispatchEvent(
          new MessageEvent('video-socket-message', { data: ev.data })
        );

      },
    }
  );

  return (
    <VideoSocketCtx.Provider value={{ sendJSON }}>
      {children}
    </VideoSocketCtx.Provider>
  );
}

export const useVideoSocketCtx = () => {
  const ctx = useContext(VideoSocketCtx);
  if (!ctx) throw new Error('useVideoSocketCtx must be inside VideoSocketProvider');
  return ctx;
};