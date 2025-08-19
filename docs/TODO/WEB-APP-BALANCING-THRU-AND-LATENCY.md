100%--the tuning does depend on the two very different capabilities you’ve packed into /docker/web-app’s world:
	1.	Distributed blobstore–backed Asset Explorer → optimize for throughput & cacheability (cheap CPU, high RPS, predictable latency).
	2.	Live multi-camera preview / monitoring / recorder → optimize for low latency & steady frame delivery (stable p50/p90; no head-of-line blocking).

Below is a split strategy that keeps the UI (Next.js) thin, moves heavy bytes off the app path, and gives each workload the right knobs.

⸻

High-level design moves
	•	Do not stream big media through Next.js.
UI = control plane. Media = data plane (MinIO presigned, WebRTC/RTSP paths via camera-proxy).
	•	Two planes, two SLAs:
	•	Explorer: static+ISR pages, CDN/proxy cache, thumbnail cache, presigned S3 URLs, range requests.
	•	Live: WebRTC (WHIP/WHEP) or LL-HLS; proxy buffering off; persistent upstream conns; QUIC/UDP where possible.
	•	Per-route Nginx policies: /assets/* (cache & precompressed), /stream/* (no buffering), /whep|/whip (upgrade, low timeouts).
	•	MinIO: use object metadata and S3 range requests; generate presigned GET for large objects so clients fetch directly (bypasses Next.js entirely).
	•	Thumbnails/Renditions: materialize and cache them (small immutable files → huge throughput win).

⸻

A) Asset Explorer (throughput-first)

1) Next.js: convert pages to ISR, long-lived static, short-lived API

/web-app/next.config.js

// /docker/web-app/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  async headers() {
    return [
      { source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/assets/thumbs/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] },
      { source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=5, s-maxage=60, stale-while-revalidate=120' }] },
    ];
  },
};
module.exports = nextConfig;

/web-app/src/app/assets/page.tsx (example: list view → ISR)

// /docker/web-app/src/app/assets/page.tsx
export const revalidate = 60; // shift work off request path

export default async function AssetsPage() {
  const data = await fetch(`${process.env.API_URL}/assets?limit=100`).then(r => r.json());
  return <AssetsTable rows={data.items} />;
}

Why: ISR removes per-request SSR CPU. Long cache on immutable assets; short cache on APIs.

⸻

2) UI fetches presigned URLs for big objects (bypass web-app)

/web-app/src/app/api/assets/[id]/download/route.ts

// /docker/web-app/src/app/api/assets/[id]/download/route.ts
import { NextResponse } from 'next/server';
import { getPresignedGet } from '@/lib/minio'; // your MinIO client

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const url = await getPresignedGet(params.id, { expiresSeconds: 3600 });
  return NextResponse.json({ url });
}

Frontend: fetch this route, then window.location = url (or fetch via <video src=url>).
Result: Your Next server never holds the bytes; only the browser ↔ MinIO path moves data.

⸻

3) Nginx: serve precompressed static & cache small thumbnails

/docker/nginx/conf.d/web-app-assets.conf

# /docker/nginx/conf.d/web-app-assets.conf
resolver 127.0.0.11 valid=30s ipv6=off;

upstream web_app_upstream {
    least_conn;
    server web-app:3000 resolve;
    keepalive 64;
}

# Immutable Next.js build assets
location ~* ^/_next/static/ {
    root /srv;                # mount prebuilt assets into /srv (see compose)
    brotli_static on;
    gzip_static on;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri.br $uri.gz $uri =404;
}

# Thumb cache (tiny objects safe to cache at the proxy)
proxy_cache_path /var/cache/nginx/thumbs levels=1:2 keys_zone=thumbs:10m max_size=1g inactive=7d use_temp_path=off;

location ^~ /assets/thumbs/ {
    proxy_cache thumbs;
    proxy_cache_lock on;
    proxy_ignore_headers X-Accel-Expires Expires Cache-Control;
    proxy_cache_valid 200 302 10m;
    proxy_cache_valid 404 1m;

    proxy_set_header Host $host;
    proxy_pass http://web_app_upstream;
}

Why: Massive RPS for explorer thumbnails with very low CPU.

⸻

B) Live multi-camera preview/monitor/record (latency-first)

Best path is WebRTC end-to-end from camera-proxy using WHIP (ingest) / WHEP (playout). If you’re on RTSP/NDI internally, terminate/bridge in camera-proxy and expose WHEP to the browser.

1) Gateway rules for streaming: no buffering, short timeouts, upgrade

/docker/nginx/conf.d/web-app-stream.conf

# /docker/nginx/conf.d/web-app-stream.conf
resolver 127.0.0.11 valid=30s ipv6=off;

upstream whep_upstream {
    least_conn;
    server camera-proxy:8080 resolve;  # your Go proxy speaking WHIP/WHEP
    keepalive 256;
}

# WHEP/WHIP HTTP(S) endpoints (WebRTC over HTTP)
location ~* ^/(whep|whip)/ {
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_read_timeout 75s;
    proxy_send_timeout 30s;
    proxy_connect_timeout 5s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Headers "*";
    if ($request_method = OPTIONS) { return 204; }

    proxy_pass http://whep_upstream;
}

# Legacy MJPEG/LL-HLS (if you expose them)
location ^~ /stream/ {
    proxy_buffering off;
    proxy_request_buffering off;
    chunked_transfer_encoding on;
    tcp_nodelay on;
    proxy_read_timeout 30s;
    proxy_pass http://whep_upstream;
}

Why: Proxy buffering/aggregation kills interactivity. Keep connections hot; keep tails down.

⸻

2) camera-proxy: add WHIP/WHEP (Pion) and sensible jitter/Bitrate caps

/camera-proxy/config.yaml

# /docker/camera-proxy/config.yaml
webrtc:
  api:
    whip_path: /whip
    whep_path: /whep
  network:
    # Prefer UDP; QUIC if you add HTTP/3 later at gateway
    ice_tcp: false
    ice_lite: true
    mdns: false
  media:
    target_bitrate_kbps: 3000      # per stream; tune per camera
    max_bitrate_kbps: 5000
    min_bitrate_kbps: 600
    keyframe_interval_ms: 1500
    jitter_buffer_ms: 60
    nack_pli: true
    simulcast: true                 # preview grid gets low layer
  record:
    container: mp4
    segment_seconds: 60
    path: /recordings

Why: Simulcast + bitrate caps = grids stay snappy; solo view can step up. Keyframe cadence keeps seek/switch quick. Jitter buffer stabilizes Wi-Fi viewers.

⸻

3) Frontend: WHEP receiver with backpressure-safe playback

/web-app/src/lib/whep.ts

// /docker/web-app/src/lib/whep.ts
export async function startWHEP(videoEl: HTMLVideoElement, url: string) {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
  pc.ontrack = (evt) => { videoEl.srcObject = evt.streams[0]; };
  pc.addTransceiver('video', { direction: 'recvonly' });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: offer.sdp!,
  });
  const answerSDP = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSDP });

  // Low-latency HTMLMediaElement hints
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  // Some browsers benefit from:
  // (videoEl as any).disableRemotePlayback = true;

  return pc;
}

/web-app/src/app/live/page.tsx

// /docker/web-app/src/app/live/page.tsx
'use client';
import { useEffect, useRef } from 'react';
import { startWHEP } from '@/lib/whep';

export default function Live() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let pc: RTCPeerConnection | null = null;
    startWHEP(ref.current, '/whep/cam/main')
      .then(p => (pc = p));
    return () => pc?.close();
  }, []);

  return <video ref={ref} muted playsInline autoPlay style={{ width: '100%' }} />;
}

Why: Browser decodes directly; Next.js only renders control UI.

⸻

C) System-level knobs (compose & host)

1) Compose: isolate CPU & memory per service (avoid web-app starvation)

/docker-compose.yaml (snippets)

services:
  video-web:
    deploy:
      resources:
        limits: { cpus: '0.80', memory: 768M }
        reservations: { cpus: '0.50', memory: 512M }
    environment:
      - NODE_OPTIONS=--max-old-space-size=512
      - UV_THREADPOOL_SIZE=8
    volumes:
      - ./docker/web-app:/app:cached
      - video-web-node_modules:/app/node_modules
      - video-web-next:/app/.next
      - video-web-npm:/root/.npm

  camera-proxy:
    deploy:
      resources:
        limits: { cpus: '1.50', memory: 1024M }
        reservations: { cpus: '1.00', memory: 768M }
    # If available on Linux hosts:
    # cpuset: "2-3"    # pin off web-app cores to reduce jitter
    # ulimits:
    #   rtprio: 99

Why: Prevent camera-proxy spikes from stealing web-app cycles (and vice versa).

⸻

D) MinIO choices that impact both
	•	Presigned URLs for any object > ~256 KB.
	•	Range requests in the player/previewer (Range: bytes=) to shave TTFB when scrubbing.
	•	Erasure coding: With 2 machines in dev, ensure at least 4 disks (e.g., 2 disks per node) to get EC stripes; avoid single-disk modes for real tests.
	•	Rendition policy: Generate and store thumb_…, proxy_720p, proxy_1080p as separate objects with immutable names → proxy caches them forever.

⸻

E) Nginx global TCP & keep-alive (latency + throughput)

/docker/nginx/nginx.conf

# /docker/nginx/nginx.conf
user nginx;
worker_processes auto;
events {
  worker_connections  4096;
  use epoll;
  multi_accept on;
}
http {
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_requests 1000;
  keepalive_timeout 65;
  gzip on;
  gzip_comp_level 5;
  gzip_min_length 1024;
  gzip_proxied any;
  gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  include /etc/nginx/conf.d/*.conf;
}


⸻

F) Quick acceptance tests

/scripts/load/explorer-rps.sh

# /docker/web-app/scripts/load/explorer-rps.sh
#!/usr/bin/env bash
set -euo pipefail
URL="${1:-http://localhost/assets?limit=100}"
hey -z 60s -c 100 "$URL"

/scripts/load/live-latency.md

1) Open /live in two browsers (Wi-Fi + wired). Confirm <1s start, <300ms switch.
2) Toggle grid→solo view; verify upswitch to higher simulcast layer within ~2s.
3) Kill one camera-proxy replica (if HA) → stream should continue.
4) Scrub a long asset using a presigned URL, watch `206 Partial Content`.


⸻

TL;DR per capability
	•	Explorer (throughput): ISR + long-cache static + proxy thumbnail cache + presigned GET for big objects. Your Next.js instance stays cool; Nginx and MinIO do the heavy lifting.
	•	Live (latency): WebRTC via camera-proxy (WHIP/WHEP), Nginx no buffering on /whep|/whip, bitrate caps + simulcast, CPU/mem isolation. Next.js renders controls only.

If you want, point me at your current camera-proxy endpoints and I’ll drop in a WHIP/WHEP handler (Pion) plus the exact Nginx routes to match your ports.




---


# Lightweight Web-App (how does this concept fit into our existing app)

You don’t need Next.js in the hot path at all. Put the frames on a zero-copy real-time pipe (WebRTC), keep the UI dumb and tiny (vanilla JS + <video>), and let Go do the heavy lifting: ingest (RTSP/USB/etc) → remux to RTP → publish via WebRTC → browser decodes natively. Below is a minimal, production-grade starter you can drop into your repo to get a super fast, low-latency camera monitor with Go + Pion; no React reconciliation, no VDOM churn.

⸻

Why this is fast
	•	WebRTC to the browser: hardware decode, jitter buffers, congestion control, all built-in. Implement with Go using pion/webrtc.  ￼ ￼
	•	Pull cameras with RTSP: read H.264 RTP and write directly to a shared TrackLocalStaticRTP. Use bluenviron/gortsplib.  ￼ ￼
	•	Tiny UI: raw <video> elements; sync UI work to frames with requestVideoFrameCallback() so overlays/metrics run only per compositor frame.  ￼ ￼

If you want an even faster "I need it working now" path, you can swap the custom Go bridge for MediaMTX (RTSP↔WebRTC proxy) and still keep the same UI. It’s a single binary/container.  ￼ ￼

⸻

BabyAGI plan (condensed)

TaskCreationChain (subtasks)
	1.	Go WebRTC gateway; 2) RTSP camera readers; 3) HTML/JS viewer; 4) Containerize; 5) Compose for LAN; 6) (Optional) MediaMTX quick path.

TaskPrioritizationChain (order)
(1) gateway → (2) RTSP → (3) UI → (4) Docker → (5) Compose → (6) alt path.

ExecutionChain (deliverables)
All code below is ready to paste and build.

⸻

1) Go WebRTC + RTSP bridge (Pion + gortsplib)

/cmd/camera-monitor/main.go

package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/bluenviron/gortsplib/v4"
	"github.com/bluenviron/gortsplib/v4/pkg/codecs/h264"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
)

//go:embed static/index.html
var indexHTML []byte

//go:embed static/app.js
var appJS []byte

type Cam struct {
	ID      string
	RTSP    string
	Track   *webrtc.TrackLocalStaticRTP
	once    sync.Once
	cancel  context.CancelFunc
	started bool
	err     error
}

type Hub struct {
	mu   sync.RWMutex
	cams map[string]*Cam
	me   *webrtc.MediaEngine
	api  *webrtc.API
}

func newHub() *Hub {
	me := &webrtc.MediaEngine{}
	// Prefer H264 (hardware decode friendly on most devices)
	if err := me.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeH264,
			ClockRate:    90000,
			SDPFmtpLine:  "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
			Channels:     0,
			SDPFormatParameters: map[string]string{},
		},
		PayloadType: 96,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		log.Fatalf("register h264: %v", err)
	}
	se := webrtc.SettingEngine{}
	// LAN usage: ICE over UDP; add TURN if you need NAT traversal
	api := webrtc.NewAPI(webrtc.WithMediaEngine(me), webrtc.WithSettingEngine(se))
	return &Hub{cams: map[string]*Cam{}, me: me, api: api}
}

func (h *Hub) loadFromEnv() {
	// Discover cams via env: CAM_RTSP_<ID>=rtsp://user:pass@host/stream
	for _, kv := range os.Environ() {
		if !strings.HasPrefix(kv, "CAM_RTSP_") {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) != 2 {
			continue
		}
		id := strings.ToLower(strings.TrimPrefix(parts[0], "CAM_RTSP_"))
		rtsp := parts[1]
		if _, ok := h.cams[id]; !ok {
			h.cams[id] = &Cam{ID: id, RTSP: rtsp}
		}
	}
}

func (h *Hub) ensureCam(id string) (*Cam, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.cams[id]
	if !ok {
		return nil, fmt.Errorf("unknown cam id: %s", id)
	}
	c.once.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		c.cancel = cancel

		// Create a shared RTP track that multiple PeerConnections can subscribe to.
		track, err := webrtc.NewTrackLocalStaticRTP(
			webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
			"video", id,
		)
		if err != nil {
			c.err = err
			return
		}
		c.Track = track

		go func() {
			log.Printf("[cam:%s] connecting RTSP: %s", id, c.RTSP)
			cli := gortsplib.Client{
				// Auto transport (UDP/TCP) selection
			}
			// Connect and start reading
			conn, _, err := cli.DialRead(c.RTSP)
			if err != nil {
				c.err = err
				return
			}
			defer conn.Close()

			// Ensure SPS/PPS are present (some cameras need in-band)
			var enc *h264.Encoder
			enc = &h264.Encoder{PayloadType: 96, PacketizationMode: 1}
			if err := enc.Init(); err != nil {
				c.err = err
				return
			}

			onRTP := func(pkt *rtp.Packet) {
				// Directly forward RTP; Pion expects RTP packets, so this is zero-copy at app level.
				if writeErr := c.Track.WriteRTP(pkt); writeErr != nil && !errors.Is(writeErr, webrtc.ErrConnectionClosed) {
					log.Printf("[cam:%s] writeRTP: %v", id, writeErr)
				}
			}

			// Register callbacks per video format found
			conn.OnPacketRTPAny(func(medi *gortsplib.Media, forma any, pkt *rtp.Packet) {
				onRTP(pkt)
			})

			c.started = true
			log.Printf("[cam:%s] streaming...", id)

			<-ctx.Done()
		}()
	})
	if c.err != nil {
		return nil, c.err
	}
	return c, nil
}

func (h *Hub) serveIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(indexHTML)
}
func (h *Hub) serveAppJS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	_, _ = w.Write(appJS)
}

// SDP offer/answer (simple JSON wrapper)
type sdpIO struct {
	SDP string `json:"sdp"`
}

func (h *Hub) handleOffer(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/offer/")
	if id == "" {
		http.Error(w, "missing cam id", 400)
		return
	}
	cam, err := h.ensureCam(id)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}

	var in sdpIO
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "invalid JSON", 400)
		return
	}

	pc, err := h.api.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	})
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	// Each viewer gets a sender bound to the shared camera track.
	sender, err := pc.AddTrack(cam.Track)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	// Keep RTCP alive
	go func() {
		rtcpBuf := make([]byte, 1500)
		for {
			if _, _, rtcpErr := sender.Read(rtcpBuf); rtcpErr != nil {
				return
			}
		}
	}()

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		if s == webrtc.PeerConnectionStateFailed || s == webrtc.PeerConnectionStateClosed || s == webrtc.PeerConnectionStateDisconnected {
			_ = pc.Close()
		}
	})

	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: in.SDP}); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	gather := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	<-gather

	out := sdpIO{SDP: pc.LocalDescription().SDP}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	h := newHub()
	h.loadFromEnv()

	mux := http.NewServeMux()
	mux.HandleFunc("/", h.serveIndex)
	mux.HandleFunc("/app.js", h.serveAppJS)
	mux.HandleFunc("/api/offer/", h.handleOffer)

	addr := ":" + envOr("PORT", "8080")
	s := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("camera-monitor serving on %s", addr)
	log.Fatal(s.ListenAndServe())
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

2) Minimal viewer UI (no framework, frame-synced overlays)

/cmd/camera-monitor/static/index.html

<!doctype html>
<html lang="en">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Camera Monitor (Go + WebRTC)</title>
<style>
  :root { --bg:#0b0d10; --fg:#e6e9ef; --ok:#6ad; --bad:#f55; }
  html,body { height:100%; margin:0; background:var(--bg); color:var(--fg); font:14px system-ui; }
  .grid { display:grid; gap:8px; padding:8px; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); }
  .tile { position:relative; background:#111; border:1px solid #222; border-radius:6px; overflow:hidden; }
  video { width:100%; height:100%; display:block; background:#000; }
  .hud { position:absolute; inset:auto 8px 8px auto; background:rgba(0,0,0,.5); padding:4px 6px; border-radius:4px; font:12px ui-monospace; }
</style>
<div class="grid" id="grid">
  <div class="tile" data-cam="cam1"><video playsinline autoplay muted></video><div class="hud"></div></div>
  <div class="tile" data-cam="cam2"><video playsinline autoplay muted></video><div class="hud"></div></div>
  <div class="tile" data-cam="cam3"><video playsinline autoplay muted></video><div class="hud"></div></div>
</div>
<script src="/app.js" type="module"></script>
</html>

/cmd/camera-monitor/static/app.js

async function connectTile(tile) {
  const camId = tile.dataset.cam;
  const video = tile.querySelector('video');
  const hud = tile.querySelector('.hud');

  const pc = new RTCPeerConnection({
    // STUN only for LAN; add TURN here if needed
    iceServers: [{urls: ['stun:stun.l.google.com:19302']}],
    // Keep it lean
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  });

  pc.addTransceiver('video', { direction: 'recvonly' });

  pc.ontrack = (ev) => {
    video.srcObject = ev.streams[0];
    video.play().catch(()=>{});
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch(`/api/offer/${camId}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({sdp: pc.localDescription.sdp})
  });
  const { sdp } = await res.json();
  await pc.setRemoteDescription({type:'answer', sdp});

  // Per-frame HUD updates with minimal overhead
  let lastTS = 0, frames = 0, dropped = 0;
  const onFrame = (now, meta) => {
    frames++;
    if (lastTS && meta.expectedDisplayTime - lastTS > 60 /*ms*/ ) dropped++;
    lastTS = meta.expectedDisplayTime;
    hud.textContent = `${camId}  fps≈${video.getVideoPlaybackQuality?.().totalVideoFrames || frames} drop=${dropped}`;
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
}

document.querySelectorAll('.tile').forEach(connectTile);

Notes:
	•	The UI uses requestVideoFrameCallback() so any overlay/metrics render exactly once per displayed frame--no React rerenders.  ￼ ￼
	•	The Go server answers a simple JSON offer/answer; you can switch this to WHEP later to be spec-compliant.  ￼

⸻

3) Containerize + compose

/docker/Dockerfile

# minimal static Go binary
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY cmd/camera-monitor ./cmd/camera-monitor
RUN apk add --no-cache build-base && \
    cd cmd/camera-monitor && \
    go mod init camera-monitor || true && \
    go get github.com/pion/webrtc/v3 github.com/bluenviron/gortsplib/v4 && \
    CGO_ENABLED=0 GOOS=linux GOARCH=$(go env GOARCH) go build -o /out/camera-monitor

FROM scratch
COPY --from=build /out/camera-monitor /camera-monitor
EXPOSE 8080
ENTRYPOINT ["/camera-monitor"]

/docker-compose.yaml

services:
  cam-mon:
    build:
      context: .
      dockerfile: docker/Dockerfile
    image: cdaprod/camera-monitor:dev
    network_mode: host   # best for LAN cameras; or expose ports if you prefer
    environment:
      PORT: "8080"
      CAM_RTSP_cam1: "rtsp://user:pass@192.168.1.10:554/stream1"
      CAM_RTSP_cam2: "rtsp://user:pass@192.168.1.11:554/stream1"
      CAM_RTSP_cam3: "rtsp://user:pass@192.168.1.12:554/stream1"
    restart: unless-stopped


⸻

4) (Optional) The "instant" path with MediaMTX

If you’d rather not implement the RTSP→WebRTC bridge yourself today, run MediaMTX and point the same UI at its WHEP endpoints. It proxies RTSP/RTMP/SRT to WebRTC/LL-HLS out of the box.  ￼ ￼

services:
  mediamtx:
    image: bluenviron/mediamtx:latest
    network_mode: host
    environment:
      MTX_PROTOCOLS: "tcp,udp,rtsp,rtmp,websocket,webtransport,webrtc"
    volumes:
      - ./mediamtx.yml:/mediamtx.yml:ro

Then change the browser to do a WHEP POST to MediaMTX (/whep/<stream>). WHEP is the standardized viewer side of WebRTC over HTTP.  ￼

⸻

Performance checklist (what makes this "feel instant")
	•	Keep React/Next.js out of the hot path. Use plain <video> + requestVideoFrameCallback() for overlays, scopes, peaking, HUD.  ￼
	•	Prefer H.264 decode in browser (widest hardware acceleration). The server advertises H.264; if a cam outputs H.265, transcode once (server-side) or use MediaMTX to remux/transcode.  ￼
	•	Zero copies in Go: forward RTP packets from RTSP to Pion’s track (WriteRTP), don’t touch the payload unless you must.  ￼
	•	One peer connection per viewer, one shared track per camera (fan-out handled by Pion).
	•	UI threading: if you add histograms/overlays, move them to a Web Worker + OffscreenCanvas. If you need manual decode paths, WebCodecs gives raw frames/encoders without wasm bloat.  ￼ ￼

⸻

When to choose other transports
	•	MJPEG (<img src="/cam1.mjpeg">) for dead-simple LAN previews (ultra-low CPU, higher bandwidth).
	•	LL-HLS for cross-device compatibility at ~2–3s latency.
	•	WHEP/WHIP when you want spec’d HTTP signalling (easy CDN integration later).  ￼

⸻

Where this fits your stack

This replaces "camera preview over Next.js" with a host/service (Go) that you can run on any node (Pi, desktop, MacBook). Your existing camera-proxy can embed the same Pion/gortsplib flow; the web-app can stay for control panels, auth, and non-realtime UX while preview panes come from this tiny HTML.

If you want, I can adapt this into your ThatDAMToolbox monorepo with your service naming and Compose includes (and add a MediaMTX profile for quick bring-up).

References for the core pieces: Pion WebRTC (Go)  ￼ ￼ · gortsplib (Go RTSP)  ￼ ￼ · MediaMTX (ready-made proxy)  ￼ · WHEP/WHIP specs (HTTP signalling)  ￼ · WebCodecs + per-frame callbacks (UI)  ￼

Want me to wire this into docker/web-app as a separate route (so your Next shell can embed these <video> tiles), or keep it entirely standalone?

