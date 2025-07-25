// src/hooks/useWsFrame.ts
import { useEffect, useRef } from 'react';

export function useWsFrame(
  url: string,
  onFrame: (blobUrl: string) => void
) {
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = ev => {
      const blob = new Blob([ev.data], { type: 'image/jpeg' });
      const url  = URL.createObjectURL(blob);
      onFrame(url);

      // Revoke old object-URL to avoid leaks
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = url;
    };

    return () => {
      ws.close();
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, [url, onFrame]);
}