// /docker/web-app/src/providers/VideoSocketProvider.tsx
'use client';

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { wsUrl }          from '@/lib/networkConfig';
import { useVideoSocket } from '@/lib/useVideoSocket';
import { bus }            from '@/lib/eventBus';

interface Ctx {
  sendJSON: (payload: any) => void;
}

const VideoSocketCtx = createContext<Ctx | null>(null);

export default function VideoSocketProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { sendJSON } = useVideoSocket(
    wsUrl(),
    {
      onMessage: (ev) => {
        console.log('[ws] message', ev.data);
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.event) {
          case 'device_list':
            bus.emit('device-list', msg.data);
            break;
          case 'recording_started':
            bus.emit('recording-start', msg.data);
            break;
          case 'recording_stopped':
            bus.emit('recording-stop', msg.data);
            break;
          case 'battery':
            bus.emit('battery', msg.data);
            break;
          case 'histogram':
            bus.emit('histogram', msg.data);
            break;
          case 'overlay_toggled':
            bus.emit('overlay-toggled', msg.data);
            break;
          case 'recording_status':
            bus.emit('recording-status', msg.data);
            break;
          default:
            console.warn('[ws] unknown frame', msg);
        }
      },
    }
  );

  useEffect(() => setMounted(true), []);
  if (!mounted)
    return <div data-video-socket-placeholder="" style={{ display: 'contents' }} />;

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