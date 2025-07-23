// src/lib/useVideoSocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface VideoSocketOptions {
  /** ms before trying to reconnect – set to 0 to disable auto-retry */
  retryDelay?: number;
  /** call-backs */
  onOpen?    : (ev: Event)             => void;
  onMessage? : (ev: MessageEvent<any>) => void;
  onError?   : (ev: Event)             => void;
  onClose?   : (ev: CloseEvent)        => void;
}

/** Super-light Web-Socket hook – keeps the ref stable */
export function useVideoSocket(
  url: string,
  { retryDelay = 3000, onOpen, onMessage, onError, onClose }: VideoSocketOptions = {},
) {
  const wsRef = useRef<WebSocket | null>(null);
  const timer = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = (ev) => {
      onOpen?.(ev);
      // clear any pending reconnect timer
      if (timer.current) clearTimeout(timer.current);
    };

    wsRef.current.onmessage = (ev) => {
      // 1) user-provided callback
        onMessage?.(ev);
        // 2️⃣ broadcast for any listener (e.g. CameraMonitor)
        window.dispatchEvent(
          new MessageEvent('video-socket-message', { data: ev.data })
        );
    };

    wsRef.current.onerror = (ev) => {
      onError?.(ev);
      wsRef.current?.close();
    };

    wsRef.current.onclose = (ev) => {
      onClose?.(ev);
      if (retryDelay > 0) {
        timer.current = setTimeout(connect, retryDelay);
      }
    };
  }, [url, retryDelay, onOpen, onMessage, onError, onClose]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [connect]);

  /** Send helpers ------------------------------------------------------- */
  const sendJSON = useCallback((obj: any) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify(obj));
  }, []);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(data);
  }, []);

  return { ws: wsRef, send, sendJSON };
}