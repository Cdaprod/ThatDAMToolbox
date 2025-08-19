/* video/web/static/components/live-preview.js
 *
 * Usage:
 *   <live-preview></live-preview>
 *   or
 *   import { initLivePreview } from './live-preview.js';
 *   await initLivePreview(document.querySelector('video'));
 *
 * Tries to negotiate a WebRTC WHEP session for low-latency preview.
 * Falls back to HLS (`/hwcapture/live/stream.m3u8`) or a demo clip when
 * features are unavailable.
 *
 * negotiateWHEP posts an SDP offer and returns the answer SDP.
 * Example:
 *   const ans = await negotiateWHEP('/whep/camera1', offer);
 */
export async function negotiateWHEP(url, sdp) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sdp })
  });
  if (!res.ok) throw new Error(`whep error: ${res.status}`);
  const data = await res.json();
  return data.sdp;
}

/**
 * initLivePreview attaches a live stream to the provided video element.
 * Returns the strategy used: 'whep', 'hls', or 'demo'.
 */
export async function initLivePreview(video) {
  try {
    const capRes = await fetch('/hwcapture/features');
    const caps = capRes.ok ? await capRes.json() : {};
    if (caps.webrtc) {
      const pc = new RTCPeerConnection();
      const stream = new MediaStream();
      pc.ontrack = (e) => stream.addTrack(e.track);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const ans = await negotiateWHEP('/whep/camera1', offer.sdp);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: ans }));
      video.srcObject = stream;
      return 'whep';
    }
  } catch (err) {
    console.error('live-preview:', err);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/hwcapture/live/stream.m3u8', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      video.src = '/hwcapture/live/stream.m3u8';
      return 'hls';
    }
  } catch (err) {
    // ignored, fall through to demo
  }
  video.src = '/demo/bars720p30.mp4';
  return 'demo';
}

// Define custom element only in browser environments
if (typeof window !== 'undefined' && window.customElements) {
  class LivePreview extends HTMLElement {
    async connectedCallback() {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      this.appendChild(video);
      try {
        await initLivePreview(video);
      } catch (err) {
        console.error('live-preview element:', err);
      }
    }
  }

  customElements.define('live-preview', LivePreview);
}