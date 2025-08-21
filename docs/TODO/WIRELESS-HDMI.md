Alright David -- here’s the fast path to clarity, then the deep cut.

What to read (fewest files/docs in ThatDAMToolbox)

Based on your current layout and our recent work, these are the minimum places that explain (or should be the single source of truth for) an "HDMI → over-Wi-Fi" transmitter feature:
	1.	video/modules/hwcapture/
Why: This is your hardware capture + synchronization plugin surface (UVC capture, audio sync, multi-device). It’s the ingest side of an HDMI transmitter.
	2.	host/services/camera-proxy/ (and its README/design note if present)
Why: This should own "transmit/serve" semantics for live preview to the LAN (your logical transmitter service). If any place already resembles a Wi-Fi HDMI TX, it’s this.
	3.	host/services/capture-daemon/
Why: Supervises and schedules capture pipelines on nodes. For a transmitter, it should coordinate hwcapture → encoder → transport selection → publish.
	4.	docker/proxy-viewer/ (and any viewer docs in docker/* or video/web/*)
Why: This is the receiver/viewer side (browser/mobile). It shows what protocols/players you already support (MJPEG/HLS/NDI/WebRTC).
	5.	host/services/api-gateway/ (routing) + docs/TECHNICAL/* (design notes)
Why: Where "device/stream registry," signaling, and multi-node routing rules should be captured. Your transmitter needs signaling/SDP or stream registry semantics here.

If any of those are light on docs, create a single doc now and make it authoritative:
	•	docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md
Put: capture paths, encoder choices (HW h264/h265), transport (WebRTC/SRT/NDI-HX), signaling, QoS, and test targets.

⸻

What the market does (and how they achieve it)

There are two families of "wireless HDMI":

A) "Zero-delay" (sub-millisecond) -- not IP/Wi-Fi
	•	Teradek Bolt 4K: custom RF in 5–6 GHz bands (not standard Wi-Fi/IP), "near-zero" latency point-to-point, used for focus-pulling and onset monitoring. They explicitly contrast "zero-delay RF" vs "Wi-Fi based" systems.  ￼ ￼
	•	WHDI/similar RF stacks (used in some consumer "wireless HDMI" kits like Nyrius/IOGEAR): uncompressed or lightly compressed over 5 GHz channel bonding; ~<1 ms latency, typically point-to-point.  ￼ ￼ ￼

Implication: This class doesn’t ride your IP network stack. You won’t reproduce "zero-delay" over regular Wi-Fi with IP protocols.

B) "Wi-Fi / IP-based" (good, not ‘zero’)
	•	Hollyland Mars 400S Pro / Pro II: advertises ~70–100 ms latency, 400–500 ft LoS, can monitor via app over Wi-Fi. This is the closest analog to what you can deliver over commodity gear.  ￼ ￼
	•	Accsoon CineView HE: dual-band 2.4/5 GHz, spec’d ≤60 ms, supports app receivers; still compressed IP video.  ￼ ￼ ￼

Implication: With hardware H.264/H.265, good radio conditions, and a real-time protocol, you can realistically hit ~60–150 ms glass-to-glass. That’s "pro enough" for directing, not for focus pulling.

⸻

Protocols you can build on (and what they buy you)
	•	WebRTC (UDP, congestion control, NAT traversal, hardware decode in browsers): best for sub-200 ms glass-to-glass in browsers; built-in jitter buffers, A/V sync, adaptive bitrate. Your camera-proxy should expose a WebRTC publisher; your viewer uses MSE/WebRTC directly.  ￼
	•	SRT (ARQ/FEC, robust over Wi-Fi): low latency, reliable, but requires an SRT player/app or gateway; browsers don’t natively play SRT.  ￼ ￼
	•	NDI (full vs HX): Full NDI is very low latency but bandwidth-heavy (~150 Mbps for 1080p60). Over Wi-Fi this can struggle unless it’s a pristine 5 GHz/6 GHz cell. NDI-HX (H.264/H.265) uses much less bandwidth but adds latency.  ￼ ￼ ￼
	•	LL-HLS/Chunked CMAF: solid fallback for scale, but even tuned you’re talking seconds, not tens of ms.  ￼

Recommendation for your stack: WebRTC first (for browser/mobile receivers), SRT second (tool/app receivers), NDI-HX optional (editorial/production tools on LAN).

⸻

Is your camera-proxy already "the Wi-Fi HDMI TX"?

Yes -- or it should be. Give it these responsibilities and you’ll match Accsoon/Hollyland-class behavior:
	1.	Capture: HDMI → UVC (or SDI) on the node running hwcapture (Pi, x86, etc.).
	2.	Encode: Hardware H.264/H.265 (VAAPI/NVENC/MMAL/V4L2 M2M) at fixed GOP/CBR.
	3.	Transport: Publish WebRTC (primary) and SRT (secondary).
	4.	Signaling/Discovery: api-gateway provides stream registry + WebRTC signaling (SDP offer/answer), ICE/TURN as needed.
	5.	Viewer: proxy-viewer uses WebRTC in-browser; fall back to LL-HLS if WebRTC fails.
	6.	QoS: Pin 80 MHz channels on 5/6 GHz APs, DFS-aware channel selection, enforce bitrate ceilings per link, ABR ladders, and short keyframes (0.5–1 s).

If you enshrine that division, camera-proxy becomes your professional "TX", and proxy-viewer becomes the "RX/app."

⸻

Can you reach "professional level"?
	•	You will not hit Teradek-class zero-delay over commodity Wi-Fi/IP; that needs proprietary RF.  ￼
	•	You can hit 60–150 ms glass-to-glass consistently, which is on par with Accsoon/Hollyland Wi-Fi systems, if you do:
	•	Hardware encode (no CPU x264 for live)
	•	WebRTC end-to-end (no HLS for "preview")
	•	Tight GOP (IDR every 0.5–1 s), look-ahead off, low-latency presets
	•	Dedicated 5/6 GHz AP, short paths, minimal contention
	•	Adaptive bitrate, packet pacing, SRTP/DTLS offload
	•	Optional SRT path for resilience (non-browser apps)

That gets you to a credible, professional Wi-Fi HDMI transmitter experience (director’s monitor, multi-client viewing, mobile monitoring), which is what Hollyland/Accsoon sell.  ￼ ￼

⸻

Concrete next steps (minimal doc + code touchpoints)

Docs to add right now
	•	docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md
Sections: (1) Capture graph, (2) Encoder matrix per device (Pi, x86, Nvidia), (3) WebRTC signaling contract (API-Gateway), (4) ABR ladders, (5) Network/QoS profile, (6) Test protocol & latency KPI.

Service responsibilities
	•	host/services/camera-proxy/: implements publisher: device selection → encoder config → WebRTC/SRT emitters → health/metrics.
	•	host/services/capture-daemon/: life-cycle & policy: when to start/stop transmitters, where to pin.
	•	host/services/api-gateway/: signaling (SDP/ICE), registry (who’s streaming), auth/ACL.
	•	docker/proxy-viewer/: WebRTC player UI + LL-HLS fallback; unify UX with your Next.js app.
	•	video/modules/hwcapture/: UVC enumeration, EDID modes, audio sync, timestamp discipline.

Performance targets to publish in the doc
	•	1080p60 @ 6–12 Mbps H.264, WebRTC <150 ms LAN
	•	1080p30 @ 4–8 Mbps fallback
	•	Multi-viewer ≥ 4 clients on a single AP (5/6 GHz)

⸻

TL;DR
	•	Yes: your camera-proxy is (or should be) the "Wi-Fi HDMI Transmitter."
	•	Target: WebRTC for sub-200 ms; add SRT for pro apps; optionally NDI-HX on pristine LANs.
	•	Reality check: Matching Teradek "zero-delay" isn’t feasible over standard Wi-Fi/IP; matching Hollyland/Accsoon performance is -- with the pipeline and QoS above.  ￼ ￼ ￼

If you want, I’ll draft the transmitter-architecture.md with the exact sections and tables (encoder caps per device class, ABR ladders, SDP contract) so you can drop it into docs/TECHNICAL/wireless-hdmi/.


Short answer: if you truly want focus-pull speed (sub-millisecond) glass-to-glass, you won’t get there on commodity Wi-Fi/IP. You either go wired & deterministic (TSN/AVB + SMPTE 2110) or proprietary 5–6 GHz/60 GHz RF links (the "zero-delay" kits). A normal Wi-Fi adapter is RF, yes--but Wi-Fi’s CSMA/CA contention + buffering prevents deterministic sub-ms. Below is the practical map of local-network options and what you can realistically hit.

Local network options (and real latencies)

1) Deterministic Ethernet (wired): AVB/TSN + SMPTE 2110
	•	AVB/TSN (IEEE 802.1AS/Qav/Qbv): Time-synchronized Ethernet with traffic shaping and reservations. Max. network delay target ≈ 2 ms across up to ~7 hops, by design. Requires AVB/TSN-capable switches/NICs.  ￼ ￼
	•	SMPTE ST 2110 (pro video over managed IP): separates video/audio/ancillary as RTP "essences," clocks everything with PTP for microsecond-level sync; most live deployments use uncompressed (2110-20) or ultra-low-latency compressed (2110-22 + JPEG-XS) which can be sub-millisecond codec latency. End-to-end "glass-to-glass" still lands in the few-ms range with proper hardware, queues, and displays.  ￼ ￼ ￼

Bottom line (wired): With 10 GbE (or better), TSN switches, PTP, and either uncompressed or JPEG-XS, you can get single-digit milliseconds end-to-end. That’s the only practical non-proprietary way to sniff "focus-pull" territory today.  ￼

2) 60 GHz "WiGig" (802.11ad/ay)
	•	802.11ad/ay trades range/robustness for huge bandwidth + directional beams. Research and vendor whitepapers highlight very low latency potential (sub-10 ms targets), but beam training/re-steering and blockage hurt determinism; it’s not a guaranteed sub-ms medium. Still far closer than 5/6 GHz Wi-Fi.  ￼ ￼ ￼

3) Wi-Fi 7 (802.11be) on 5/6 GHz
	•	Adds Multi-Link Operation (MLO), wider 320 MHz channels, and "deterministic low-latency" marketing. It reduces latency vs Wi-Fi 6/6E, but does not guarantee sub-ms under contention. Great for <~50–100 ms targets, not focus-pull.  ￼ ￼ ￼

4) "Zero-delay" pro links (not IP)
	•	Teradek-class systems use proprietary RF PHYs (not standard Wi-Fi/IP) at 5–6 GHz or 60 GHz to achieve near-zero latency. You won’t replicate that with a generic Wi-Fi adapter.  ￼

⸻

If you refuse NDI and want "better": what to build

You can out-engineer a bespoke ultra-low-latency LAN stack without NDI by borrowing from 2110/TSN concepts:
	1.	Clocking & pacing
	•	Adopt PTP (IEEE 1588 / 802.1AS gPTP) end-to-end. Everything (capture, encoder, sender pacing, receiver playout) rides the same wall clock. This is how 2110 keeps streams aligned within microseconds.  ￼ ￼
	•	Implement constant-bit-rate, line-paced RTP senders (2110-21 "Narrow Linear-ish" behavior) to minimize burstiness and RX buffering.  ￼
	2.	Transport
	•	RTP/UDP unicast or multicast on a managed, non-congested VLAN. Add 802.1Qav/Qbv shaping if your switches support TSN to bound queueing.  ￼
	•	If you must compress, use intra-only, slice-based, low-delay profiles (e.g., all-I H.264/H.265 with very short GOP, or JPEG-XS if you can license it; XS gives line-level latency).  ￼
	3.	Buffers
	•	Hard-cap RX de-jitter buffers (aim <1 frame), use PTP-scheduled playout, and avoid multi-frame decoder look-ahead. This is where you win or lose milliseconds.
	4.	Network fabric
	•	Prefer 10 GbE or 2.5/5 GbE links, TSN-capable switches, and pinned paths/VLANs. Avoid Wi-Fi if your KPI is sub-ms.
	5.	Display pipeline
	•	Pick sinks that accept low-latency modes and expose scan-out timing (e.g., gen-lockable SDI/HDMI or panels with VRR/low-latency). Your display adds several ms otherwise.

⸻

Where ThatDAMToolbox fits (concrete wiring)
	•	video/modules/hwcapture/
Add PTP time-stamping at capture and expose capture-clock domain to the pipeline.
	•	host/services/camera-proxy/ (your TX)
Implement RTP/UDP sender with CBR pacing, 2110-style timestamps, and optional JPEG-XS / all-I H.264. Expose PTP status and TX pacing stats.
	•	host/services/api-gateway/
Provide session description (SDP) + multicast group registry; expose PTP health so receivers can refuse out-of-sync senders.
	•	docker/proxy-viewer/ (your RX)
Add RTP/UDP player that locks to PTP, with sub-frame de-jitter and bounded playout modes.
	•	Network
If you can, stand up a TSN/AVB island (802.1AS/Qav) between TX and RX. Even basic AVB gets you a 2 ms bound over multiple hops--orders better than Wi-Fi’s best-effort queues.  ￼

⸻

So… can a "normal Wi-Fi adapter" get you there?
	•	It’s RF, yes--but standard Wi-Fi (2.4/5/6 GHz) is contention-based and non-deterministic, so no for sub-ms.
	•	60 GHz (802.11ad/ay) is the only semi-consumer "wireless Ethernet" that can approach ultra-low latency, but even then, expect sub-10 ms at best, not sub-1 ms in real life, and only in short-range, line-of-sight scenarios with careful beamforming.  ￼ ￼ ￼

⸻

Recommended path (to hit focus-pull territory without proprietary RF)
	1.	Wired "pro mode": Build a 2110-like pipeline on a TSN/AVB island (10 GbE, PTP grandmaster, CBR RTP pacing, minimal buffers). That’s how you credibly get single-digit milliseconds on open standards.  ￼
	2.	Wireless "dev mode": Experiment with 802.11ad/ay dev kits for short-range links; treat them like a wireless HDMI "cable replacement," but don’t promise sub-ms.  ￼ ￼
	3.	Commodity Wi-Fi "shipping mode": Keep WebRTC/SRT for director’s monitors (<~60–150 ms); be explicit it’s not for focus pulling.

If you want, I’ll draft a docs/TECHNICAL/low-latency-lan/README.md that codifies:
	•	PTP plan (grandmaster, domains, failover)
	•	TX pacing requirements (RTP timestamps, 2110-21-like behavior)
	•	Switch config snippets for 802.1AS/Qav/Qbv
	•	RX playout policy & buffer budgets
	•	A/B test harness for glass-to-glass latency with KPIs and acceptance gates.


