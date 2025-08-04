// src/hooks/useMediaRecorder.ts
import { useRef, useState, useCallback } from 'react';

export interface RecorderOptions {
  /** target mime-types, in priority order */
  mimeTypes?: string[];
  /** outgoing bitrate */
  videoBitsPerSecond?: number;
  /** frame-rate to request from the source */
  frameRate?: number;
  /** ms between dataavailable events */
  chunkInterval?: number;
}

export function useMediaRecorder({
  mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=h264'],
  videoBitsPerSecond = 2_500_000,
  frameRate = 30,
  chunkInterval = 100,
}: RecorderOptions = {}) {
  // are we recording right now?
  const [recording, setRecording] = useState(false);
  // holds the last completed Blob
  const [lastBlob, setLastBlob]   = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  const start = useCallback((videoEl: HTMLVideoElement) => {
    if (recorderRef.current) return;     // already recording
    chunksRef.current = [];

    // 1) grab the video element’s live stream (no NaN frameRate)
    const stream = (videoEl as any).captureStream();


    // 2) pick a supported mime
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || mimeTypes[0];

    // 3) create recorder
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });

    rec.ondataavailable = e => {
      if (e.data.size) chunksRef.current.push(e.data);
    };

    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      recorderRef.current = null;
      setRecording(false);
      setLastBlob(blob);
    };

    rec.start(chunkInterval);
    recorderRef.current = rec;
    setRecording(true);
  }, [mimeTypes, videoBitsPerSecond, frameRate, chunkInterval]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    rec.stop();    // triggers rec.onstop above
  }, []);

  const toggle = useCallback((videoEl?: HTMLVideoElement) => {
    return recording
      ? stop()
      : videoEl
        ? start(videoEl)
        : undefined;
  }, [recording, start, stop]);

  return { recording, lastBlob, start, stop, toggle };
}