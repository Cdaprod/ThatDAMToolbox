"use client";
import { useEffect, useState } from "react";

interface StreamInfo {
  src?: string;
  stream?: MediaStream;
  fallback: boolean;
}

export function useCameraStream(): StreamInfo {
  const [info, setInfo] = useState<StreamInfo>({ fallback: false });
  useEffect(() => {
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;

    async function init() {
      try {
        const capRes = await fetch("/hwcapture/features");
        const caps = capRes.ok ? await capRes.json() : {};
        if (caps.webrtc) {
          pc = new RTCPeerConnection();
          const stream = new MediaStream();
          pc.ontrack = (e) => stream.addTrack(e.track);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const ansRes = await fetch("/hwcapture/webrtc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sdp: pc.localDescription }),
          });
          const data = await ansRes.json();
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (!cancelled) setInfo({ stream, fallback: false });
          return;
        }
      } catch {}

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      fetch("/hwcapture/live/stream.m3u8", {
        method: "HEAD",
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("not ok");
          setInfo({ src: "/hwcapture/live/stream.m3u8", fallback: false });
        })
        .catch(() => {
          setInfo({ src: "/demo/bars720p30.mp4", fallback: true });
        })
        .finally(() => clearTimeout(timer));
    }

    init();
    return () => {
      cancelled = true;
      pc?.close();
    };
  }, []);
  return info;
}
