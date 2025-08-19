// src/hooks/useLiveRecorder.ts
import { useState, useCallback, useEffect } from 'react';
import { useVideoSocketCtx } from '@/providers/VideoSocketProvider';
import { bus } from '@/lib/eventBus';

type RecState = 'idle' | 'starting' | 'recording' | 'stopping';

export function useLiveRecorder(config: {
  feed?: 'main' | 'aux';
  device: string;
  codec: 'h264' | 'hevc';
  getTimecode: () => string;
}) {
  const { sendJSON } = useVideoSocketCtx();
  const [status, setStatus] = useState<RecState>('idle');

  // listen for backend confirms
  useEffect(() => {
    const onStarted = () => setStatus('recording');
    const onStopped = () => setStatus('idle');
    bus.on('recording-start', onStarted);
    bus.on('recording-stop', onStopped);
    return () => {
      bus.off('recording-start', onStarted);
      bus.off('recording-stop', onStopped);
    };
  }, []);

  const start = useCallback(() => {
    if (status !== 'idle') return;
    setStatus('starting');
    const now = new Date().toISOString().replace(/[:.]/g,'-');
    sendJSON({
      action:   'start_record',
      feed:     config.feed ?? 'main',
      device:   config.device,
      filename: `capture_${now}.mp4`,
      codec:    config.codec,
      timecode: config.getTimecode(),
    });
  }, [status, sendJSON, config]);

  const stop = useCallback(() => {
    if (status !== 'recording') return;
    setStatus('stopping');
    sendJSON({ action: 'stop_record', feed: config.feed ?? 'main' });
  }, [status, sendJSON, config]);

  const toggle = useCallback(() => {
    status === 'idle' ? start() : status === 'recording' && stop();
  }, [status, start, stop]);

  return { status, start, stop, toggle };
}