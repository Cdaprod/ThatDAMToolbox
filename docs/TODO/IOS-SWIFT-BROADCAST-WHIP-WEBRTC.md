What if device allows screen recording broadcasts like latest iOS iPhone features?

Totally doable. Here’s a clean way to add the iOS WHIP "adapter" to your repo without polluting your Docker world, plus how to test it, and whether a PWA can replace it (short answer: no, not for Control Center screen-broadcast).

⸻

Where it goes in this monorepo

Add a top-level clients area with a mobile/iOS subtree. This keeps parity if you later add Android or desktop apps.

/clients/ios/README.md

# ThatDAM iOS Adapter (ReplayKit → WHIP)
- Host app writes WHIP config to App Group.
- Broadcast Upload Extension pushes iOS screen via WebRTC (H.264) to your WHIP endpoint.

/clients/ios/.gitignore

# Xcode + CocoaPods artifacts
DerivedData/
build/
*.xcworkspace
Pods/
Podfile.lock

/clients/ios/Podfile

platform :ios, '16.0'
use_frameworks!

target 'ThatDAMAdapter' do
  pod 'GoogleWebRTC'
end

target 'ThatDAMBroadcast' do
  pod 'GoogleWebRTC'
end

/clients/ios/ThatDAMAdapterApp/ThatDAMAdapterApp.swift

import SwiftUI

@main
struct ThatDAMAdapterApp: App {
  var body: some Scene { WindowGroup { ConfigView() } }
}

/clients/ios/ThatDAMAdapterApp/ConfigView.swift

import SwiftUI
import ReplayKit

private let appGroup = "group.dev.cdaprod.thatdam"

struct ConfigView: View {
  @State private var whipURL = UserDefaults(suiteName: appGroup)?.string(forKey: "whipURL") ?? "https://video-api.local/whip/iphone"
  @State private var token   = UserDefaults(suiteName: appGroup)?.string(forKey: "whipBearer") ?? ""

  var body: some View {
    NavigationView {
      Form {
        Section(header: Text("WHIP Target")) {
          TextField("WHIP URL", text: $whipURL).textInputAutocapitalization(.never).autocorrectionDisabled(true)
          SecureField("Bearer token (optional)", text: $token)
          Button("Save") {
            let ud = UserDefaults(suiteName: appGroup)
            ud?.set(whipURL, forKey: "whipURL")
            ud?.set(token, forKey: "whipBearer")
          }
        }
        Section(header: Text("Start from Control Center")) {
          Text("Control Center → Screen Recording (long-press) → select "ThatDAM Broadcast" → Start. Toggle Mic if needed.")
            .font(.footnote)
        }
        Section(header: Text("Shortcut Button (optional)")) {
          BroadcastPicker().frame(height: 50)
        }
      }.navigationTitle("ThatDAM WHIP Adapter")
    }
  }
}

struct BroadcastPicker: UIViewRepresentable {
  func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
    let v = RPSystemBroadcastPickerView()
    v.preferredExtension = "dev.cdaprod.thatdam.broadcast" // set your extension bundle id
    v.showsMicrophoneButton = true
    return v
  }
  func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}

/clients/ios/ThatDAMBroadcast/SampleHandler.swift

import ReplayKit
import WebRTC
import AVFoundation

private let appGroup = "group.dev.cdaprod.thatdam"

final class SampleHandler: RPBroadcastSampleHandler {
  private let publisher = WHIPPublisher()
  private var started = false
  private var whipURL: URL = URL(string: "https://video-api.local/whip/iphone")!
  private var bearer: String? = nil

  override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
    if let ud = UserDefaults(suiteName: appGroup) {
      if let s = ud.string(forKey: "whipURL"), let u = URL(string: s) { whipURL = u }
      bearer = ud.string(forKey: "whipBearer")
    }
    let ice = [ RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]) ]
    publisher.start(
      config: WHIPConfig(url: whipURL, bearer: bearer, iceServers: ice),
      onReady: { [weak self] in self?.started = true },
      onError: { [weak self] err in self?.finishBroadcastWithError(err) }
    )
  }

  override func broadcastFinished() {
    publisher.stop()
    started = false
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    if case .video = sampleBufferType { publisher.push(sampleBuffer: sampleBuffer) }
    // audioMic/audioApp injection omitted (v1 uses WebRTC mic capture if enabled later)
  }
}

/clients/ios/ThatDAMBroadcast/WebRTCWHIP.swift

import Foundation
import WebRTC

struct WHIPConfig { let url: URL; let bearer: String?; let iceServers: [RTCIceServer] }

final class WHIPPublisher: NSObject {
  private let factory: RTCPeerConnectionFactory
  private var pc: RTCPeerConnection?
  private var videoSource: RTCVideoSource?
  private var videoTrack: RTCVideoTrack?
  private var audioTrack: RTCAudioTrack?
  private var resourceURL: URL?
  private let session = URLSession(configuration: .ephemeral)
  private var trickleQueue: [RTCIceCandidate] = []

  override init() {
    RTCInitializeSSL()
    let encoderFactory = RTCDefaultVideoEncoderFactory()
    let decoderFactory = RTCDefaultVideoDecoderFactory()
    factory = RTCPeerConnectionFactory(encoderFactory: encoderFactory, decoderFactory: decoderFactory)
    super.init()
  }
  deinit { RTCCleanupSSL() }

  func start(config: WHIPConfig, onReady: @escaping () -> Void, onError: @escaping (Error) -> Void) {
    let rtc = RTCConfiguration()
    rtc.sdpSemantics = .unifiedPlan
    rtc.iceServers = config.iceServers
    rtc.continualGatheringPolicy = .gatherContinually
    let pc = factory.peerConnection(with: rtc, constraints: .init(mandatoryConstraints: nil, optionalConstraints: ["DtlsSrtpKeyAgreement":"true"]), delegate: self)
    self.pc = pc

    // video
    videoSource = factory.videoSource()
    videoTrack = factory.videoTrack(with: videoSource!, trackId: "video0")
    let v = pc.addTransceiver(with: videoTrack!, streamIds: ["stream0"]); v.direction = .sendOnly

    // simple mic (optional later)
    let audioSource = factory.audioSource(with: .init(mandatoryConstraints: nil, optionalConstraints: nil))
    audioTrack = factory.audioTrack(with: audioSource, trackId: "audio0")
    let a = pc.addTransceiver(with: audioTrack!, streamIds: ["stream0"]); a.direction = .sendOnly

    pc.offer(for: .init(mandatoryConstraints: ["OfferToReceiveAudio":"false","OfferToReceiveVideo":"false"], optionalConstraints: nil)) { [weak self] sdp, err in
      guard let self, let pc = self.pc else { return }
      if let err = err { onError(err); return }
      guard let sdp = sdp else { onError(NSError(domain: "webrtc", code: -1)); return }
      pc.setLocalDescription(sdp) { setErr in
        if let setErr = setErr { onError(setErr); return }
        Task {
          do {
            let (resource, answer) = try await self.whipPost(whipURL: config.url, bearer: config.bearer, sdp: sdp.sdp)
            self.resourceURL = resource
            try await self.setRemote(answer: answer)
            onReady()
            await self.flushTrickle()
          } catch { onError(error) }
        }
      }
    }
  }

  func stop() { pc?.close(); pc = nil; videoTrack = nil; videoSource = nil; audioTrack = nil }

  func push(sampleBuffer: CMSampleBuffer) {
    guard let pb = CMSampleBufferGetImageBuffer(sampleBuffer), let vs = videoSource else { return }
    let ts = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
    let rtcb = RTCCVPixelBuffer(pixelBuffer: pb)
    vs.capturer(nil, didCapture: RTCVideoFrame(buffer: rtcb, rotation: ._0, timeStampNs: Int64(ts * 1_000_000_000)))
  }

  private func whipPost(whipURL: URL, bearer: String?, sdp: String) async throws -> (URL, String) {
    var r = URLRequest(url: whipURL); r.httpMethod = "POST"; r.setValue("application/sdp", forHTTPHeaderField: "Content-Type")
    if let b = bearer, !b.isEmpty { r.setValue("Bearer \(b)", forHTTPHeaderField: "Authorization") }
    r.httpBody = sdp.data(using: .utf8)
    let (data, resp) = try await session.data(for: r)
    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw NSError(domain: "whip", code: (resp as? HTTPURLResponse)?.statusCode ?? -1)
    }
    guard let loc = http.value(forHTTPHeaderField: "Location"), let resURL = URL(string: loc) else {
      throw NSError(domain: "whip", code: -2)
    }
    return (resURL, String(data: data, encoding: .utf8) ?? "")
  }

  private func setRemote(answer: String) async throws {
    try await withCheckedThrowingContinuation { cont in
      pc?.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: answer)) { err in
        err == nil ? cont.resume() : cont.resume(throwing: err!)
      }
    }
  }

  private func sendCandidate(_ c: RTCIceCandidate) async {
    guard let res = resourceURL else { trickleQueue.append(c); return }
    var r = URLRequest(url: res); r.httpMethod = "PATCH"
    r.setValue("application/trickle-ice+json", forHTTPHeaderField: "Content-Type")
    r.httpBody = try? JSONSerialization.data(withJSONObject: ["candidate": c.sdp, "sdpMid": c.sdpMid ?? "0", "sdpMLineIndex": c.sdpMLineIndex])
    _ = try? await session.data(for: r)
  }

  private func flushTrickle() async { for c in trickleQueue { await sendCandidate(c) }; trickleQueue.removeAll() }
}

extension WHIPPublisher: RTCPeerConnectionDelegate {
  func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) { Task { await sendCandidate(candidate) } }
  func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
}

/clients/ios/ThatDAMAdapterApp/ThatDAMAdapter.entitlements

<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>com.apple.security.application-groups</key>
  <array><string>group.dev.cdaprod.thatdam</string></array>
</dict></plist>

/clients/ios/ThatDAMBroadcast/ThatDAMBroadcast.entitlements

<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>com.apple.security.application-groups</key>
  <array><string>group.dev.cdaprod.thatdam</string></array>
</dict></plist>

/clients/ios/ThatDAMBroadcast/Info.plist

<key>NSExtension</key>
<dict>
  <key>NSExtensionAttributes</key>
  <dict>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeApp</string>
  </dict>
  <key>NSExtensionPointIdentifier</key>
  <string>com.apple.broadcast-services-upload</string>
  <key>NSExtensionPrincipalClass</key>
  <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
</dict>

In Xcode: create an iOS App target (ThatDAMAdapter) and a Broadcast Upload Extension target (ThatDAMBroadcast), then drop these files in.

⸻

How to test the iOS Swift app (real device)
	1.	Server ready

	•	Your video-api must expose a WHIP endpoint, e.g. https://<host>/whip/iphone, returning 201 + Location + SDP answer, and accept PATCH application/trickle-ice+json for candidates.
	•	Confirm by curling a dummy offer from tests, or point any WHIP test client at it.

	2.	Xcode setup

	•	Open /clients/ios in Xcode (or the generated .xcworkspace after pod install).
	•	Set Bundle IDs:
	•	App: dev.cdaprod.thatdam.adapter
	•	Extension: dev.cdaprod.thatdam.broadcast
	•	Enable App Groups for both targets → group.dev.cdaprod.thatdam.
	•	Team signing: your Apple Developer Team (free dev profile works for device testing).

	3.	Run on device

	•	Build & run ThatDAMAdapter on your iPhone.
	•	In the app, set WHIP URL (e.g., https://gw.local/whip/iphone) and optional Bearer; tap Save.

	4.	Start broadcast

	•	iPhone Control Center → long-press Screen Recording → choose ThatDAM Broadcast → Start Broadcast (toggle Mic if needed later).
	•	Watch your video-api logs: Offer → Answer → ICE candidates.

	5.	View in your web-app

	•	Your Next.js /dashboard/live WHEP player should show the new iphone source. If you don’t have a card, point any WebRTC subscriber (WHEP) to the room and verify playback.

⸻

PWA vs App Store app -- do you need an app?
	•	PWA / Web only: You can do in-tab screen capture with getDisplayMedia inside Safari (or installed PWA), but you cannot register as a system Screen Broadcast target (the Control Center workflow). Also, on iOS Safari you won’t get system audio, background capture, or reliable long-running session behavior.
	•	ReplayKit Screen Broadcast (what you want): requires a native app with a Broadcast Upload Extension installed on the device. That can be:
	•	Local dev build (Xcode) for yourself,
	•	TestFlight for testers, or
	•	App Store for public distribution.

So: for true device-wide screen broadcast from Control Center to your WHIP ingest, yes, a native iOS app/extension is required. A PWA cannot replace that.

Hybrid recommendation (best UX):
	•	Keep web capture in your web-app (nice for laptops/desktops).
	•	Ship the iOS adapter for mobile creators who need system-level broadcast and background stability.

⸻

Minimal repo touch points (so you stay idempotent)
	•	No changes to docker/** required.
	•	Optionally reference the iOS adapter in your docs:

/docs/TECHNICAL/PLATFORM-AS-A-SERVICE-TASKS.md

## iOS WHIP Adapter
- Source: `/clients/ios`
- Publishes iOS screen -> `video-api` WHIP endpoint.
- Distribution: dev build / TestFlight / App Store.

/README.md

### Mobile
- iOS WHIP Adapter (ReplayKit → WebRTC/WHIP) lives in `/clients/ios`.
- See `/clients/ios/README.md` for setup and testing.


⸻

Quick checklists

Signing & IDs
	•	App Group: group.dev.cdaprod.thatdam
	•	Extension bundle id in BroadcastPicker: dev.cdaprod.thatdam.broadcast

WHIP server
	•	H.264 (VideoToolbox) accepted
	•	201 Created + Location header (resource URL)
	•	Trickle ICE via PATCH application/trickle-ice+json

NAT
	•	Add TURN for the field: you can later inject

RTCIceServer(urlStrings:["turn:turn.domain:3478"], username:"u", credential:"p")

into iceServers.

If you want, I’ll add a TURN config snippet, a curl WHIP probe under /tests/whip/, and a WHEP player card tweak in docker/web-app/src/app/dashboard/live/page.tsx to show the iPhone feed prominently.