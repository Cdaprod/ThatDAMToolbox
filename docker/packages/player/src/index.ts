/**
 * createPlayer attaches a resilient video player using WebRTC with
 * fallbacks to HLS and MJPEG.
 *
 * Usage:
 *   const destroy = createPlayer(video, { source: '/stream/cam0' })
 *   // later: destroy()
 */

export interface PlayerOptions {
  source: string;
}

type PlayFn = (el: HTMLVideoElement, src: string) => Promise<void>;

export async function tryPlay(el: HTMLVideoElement, src: string, order: PlayFn[]): Promise<void> {
  for (const fn of order) {
    try {
      await fn(el, src);
      return;
    } catch {
      // continue to next strategy
    }
  }
  throw new Error('playback failed');
}

export function createPlayer(el: HTMLVideoElement, opts: PlayerOptions) {
  const steps: PlayFn[] = [playWebRTC, playHLS, playMJPEG];
  tryPlay(el, opts.source, steps).catch(() => {/* noop */});
  return () => {
    try { el.pause(); } catch {}
    try { el.removeAttribute('src'); } catch {}
  };
}

async function playWebRTC(el: HTMLVideoElement, src: string): Promise<void> {
  if (!("RTCPeerConnection" in globalThis)) throw new Error('unsupported');
  el.src = src + '/webrtc';
  await el.play();
}

async function playHLS(el: HTMLVideoElement, src: string): Promise<void> {
  if (!el.canPlayType('application/vnd.apple.mpegurl')) throw new Error('unsupported');
  el.src = src + '/index.m3u8';
  await el.play();
}

async function playMJPEG(el: HTMLVideoElement, src: string): Promise<void> {
  el.src = src + '.mjpeg';
  await el.play();
}
