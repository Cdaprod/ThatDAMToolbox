// lib/useVideoWs.ts
import { useEffect, useRef } from 'react';

export function useVideoWs(onMsg: (ev: MessageEvent) => void) {
  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener('message', onMsg);
    ws.addEventListener('open', () => console.log('[WS] connected'));
    ws.addEventListener('close', () => console.log('[WS] closed'));
    ws.addEventListener('error', (e) => console.error('[WS] error', e));

    return () => ws.close();
  }, [onMsg]);

  return wsRef;
}