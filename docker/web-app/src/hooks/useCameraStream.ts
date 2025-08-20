"use client";
import { useEffect, useState } from "react";

/**
 * useCameraStream negotiates a WHEP session when available and
 * falls back to HLS or a demo clip otherwise.
 *
 * Example:
 * ```ts
 * const { stream } = useCameraStream();
 * ```
 */
interface StreamInfo {
  src?: string;
  stream?: MediaStream;
  fallback: boolean;
}

/**
 * getLocalStream requests the user's webcam via getUserMedia.
 *
 * Example:
 * ```ts
 * const stream = await getLocalStream();
 * ```
 */
export async function getLocalStream(): Promise<MediaStream> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia not supported");
  }
  return navigator.mediaDevices.getUserMedia({ video: true });
}

/**
 * negotiateWHEP posts an SDP offer to the given URL and returns the answer SDP.
 *
 * Example:
 * ```ts
 * const ans = await negotiateWHEP('/whep/camera1', offer.sdp!);
 * ```
 */
export async function negotiateWHEP(url: string, sdp: string): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp }),
  });
  if (!res.ok) throw new Error(`whep error: ${res.status}`);
  const data = await res.json();
  return data.sdp;
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
          const ans = await negotiateWHEP("/whep/camera1", offer.sdp!);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: ans }));
          if (!cancelled) setInfo({ stream, fallback: false });
          return;
        }
      } catch {
        // ignored; fallback path handles errors
      }

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
        .catch(async () => {
          try {
            const stream = await getLocalStream();
            if (!cancelled) setInfo({ stream, fallback: true });
          } catch {
            setInfo({ src: "/demo/bars720p30.mp4", fallback: true });
          }
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
