'use client';
import { useEffect } from 'react';
import type { TimeRange } from '../lib/media/types';

// Hook to skip clipped spans during playback based on kept ranges
export function useEdlPlayback(video: HTMLVideoElement | null, kept: TimeRange[] | null) {
  useEffect(() => {
    if (!video || !kept?.length) return;
    const onTime = () => {
      const t = video.currentTime;
      const seg = kept.find(s => t >= s.start && t < s.end);
      if (seg) return;
      const next = kept.find(s => t < s.start);
      if (next) video.currentTime = next.start;
      else video.pause();
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [video, kept]);
}

