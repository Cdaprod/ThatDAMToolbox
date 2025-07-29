'use client';

import { useEffect, useRef, useCallback } from 'react';
import { wsUrl } from './networkConfig';

export interface UseVideoWsReturn {
  /** Mutable ref to the underlying WebSocket */
  wsRef: React.MutableRefObject<WebSocket | undefined>;
  /** Send a JSON message over WS if open */
  sendJSON: (obj: any) => void;
}

/**
 * Lightweight WebSocket hook for your video stream + control socket.
 * - onMsg: callback for raw MessageEvent
 * - always re-broadcasts to `window` for any other listener
 */
export function useVideoWs(
  onMsg: (ev: MessageEvent) => void
): UseVideoWsReturn {
  const wsRef = useRef<WebSocket>();
  const sendJSON = useCallback((obj: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  useEffect(() => {
    // Use your wsUrl utility for consistent, dynamic WS URLs
    const url = wsUrl('/ws/camera');
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener('open', () => console.log('[WS] connected'));
    ws.addEventListener('message', (ev) => {
      // user callback
      onMsg(ev);
      // broadcast for any window listener
      window.dispatchEvent(
        new MessageEvent('video-socket-message', { data: ev.data })
      );
    });
    ws.addEventListener('close', () => console.log('[WS] closed'));
    ws.addEventListener('error', (e) => console.error('[WS] error', e));

    return () => {
      ws.close();
    };
  }, [onMsg]);

  return { wsRef, sendJSON };
}