'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { CaptureContext, Codec } from './CaptureContext';
import { bus } from '@/lib/eventBus';
import { useTimecode } from '@/hooks/useTimecode';

export default function CaptureProvider({ children }: { children: ReactNode }) {

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

  // 4) Timecode
  const { tc: _tc, format } = useTimecode();
  const timecode = format();

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
  // Start/stop recording via capture-daemon HTTP endpoints.
  // Example:
  // await fetch('/daemon/record/start', { method: 'POST' })
  const start = () => {
    fetch('/daemon/record/start', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('start failed');
        setRecording(true);
      })
      .catch((err) => console.error(err));
  };
  const stop = () => {
    fetch('/daemon/record/stop', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('stop failed');
        setRecording(false);
      })
      .catch((err) => console.error(err));
  };

  return (
    <CaptureContext.Provider
      value={{
        recording,
        start,
        stop,

        selectedDevice,
        setSelectedDevice,
        selectedCodec,
        setSelectedCodec,
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