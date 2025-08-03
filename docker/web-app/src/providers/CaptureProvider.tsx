// src/providers/CaptureProvider.tsx
'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { useVideoSocketCtx } from './VideoSocketProvider';
import { CaptureContext, Codec } from './CaptureContext';
import { bus } from '@/lib/eventBus';
import { useTimecode } from '@/hooks/useTimecode';

export default function CaptureProvider({ children }: { children: ReactNode }) {
  const { sendJSON } = useVideoSocketCtx();

  // 1) Recording toggle
  const [recording, setRecording] = useState(false);

  // 2) Current device & codec
  const [selectedDevice, setSelectedDevice] = useState<string>('/dev/video0');
  const [selectedCodec, setSelectedCodec]   = useState<Codec>('h264');

  // 3) Device capabilities
  const [deviceInfo, setDeviceInfo] = useState({
    width:  1280,
    height: 720,
    fps:    30,
  });

  // 4) Timecode (hh:mm:ss:ff)
  const { format } = useTimecode({ h: 0, m: 0, s: 0, f: 0 });
  const timecode   = format();

  // 5) Overlays
  const [overlays, setOverlays] = useState({
    focusPeaking: false,
    zebras:       false,
    falseColor:   false,
  });

  // 6) Histogram buckets
  const [histogramData, setHistogramData] = useState<number[]>([]);

  // 7) Server‐driven recording time (seconds)
  const [recordingTime, setRecordingTime] = useState(0);

  // 8) Subscribe to backend events
  useEffect(() => {
    const onDeviceList = (list: Array<{ path: string; width: number; height: number; fps: number }>) => {
      if (list.length > 0) {
        const d = list[0];
        setSelectedDevice(d.path);
        setDeviceInfo({ width: d.width, height: d.height, fps: d.fps });
      }
    };
    const onOverlayToggled = (d: { overlay: keyof typeof overlays; enabled: boolean }) => {
      setOverlays(o => ({ ...o, [d.overlay]: d.enabled }));
    };
    const onHistogram     = (d: { buckets: number[] }) => setHistogramData(d.buckets);
    const onRecStatus     = (d: { feed: string; elapsed: number }) => setRecordingTime(d.elapsed);
    const onRecStart      = () => setRecording(true);
    const onRecStop       = () => setRecording(false);

    bus.on('device-list',      onDeviceList);
    bus.on('overlay-toggled',  onOverlayToggled);
    bus.on('histogram',        onHistogram);
    bus.on('recording-start',  onRecStart);
    bus.on('recording-stop',   onRecStop);
    bus.on('recording-status', onRecStatus);

    return () => {
      bus.off('device-list',      onDeviceList);
      bus.off('overlay-toggled',  onOverlayToggled);
      bus.off('histogram',        onHistogram);
      bus.off('recording-start',  onRecStart);
      bus.off('recording-stop',   onRecStop);
      bus.off('recording-status', onRecStatus);
    };
  }, []);

  // 9) Expose start/stop controls
  const start = () => {
    sendJSON({ action: 'start_record' });
    setRecording(true);
  };
  const stop = () => {
    sendJSON({ action: 'stop_record' });
    setRecording(false);
  };

  return (
    <CaptureContext.Provider
      value={{
        recording,
        start,
        stop,

        selectedDevice,
        setSelectedDevice,    // <<=== ADDED
        selectedCodec,
        setSelectedCodec,     // <<=== ADDED
        deviceInfo,

        timecode,
        overlays,
        histogramData,
        recordingTime,
      }}
    >
      {children}
    </CaptureContext.Provider>
  );
}