// Tests for initLivePreview and negotiateWHEP
// Example: node --test live-preview.test.js
import test from 'node:test';
import assert from 'node:assert';
import { initLivePreview, negotiateWHEP } from '../live-preview.js';

// stub MediaStream for Node
class FakeStream {
  constructor() { this.tracks = []; }
  addTrack(t) { this.tracks.push(t); }
}

// helper to reset globals
function reset() {
  delete (global).fetch;
  delete (global).RTCPeerConnection;
  delete (global).RTCSessionDescription;
  (global).MediaStream = FakeStream;
}

// Test negotiateWHEP function
// Similar to hook test but using JS version
reset();

(test('negotiateWHEP posts offer and returns answer', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ sdp: 'answer' }) };
  };
  const ans = await negotiateWHEP('/whep/cam1', 'offer');
  assert.strictEqual(ans, 'answer');
  assert.strictEqual(calls[0].url, '/whep/cam1');
  assert.strictEqual(JSON.parse(calls[0].opts.body).sdp, 'offer');
}));

// Test WHEP path in initLivePreview
reset();

(test('initLivePreview uses WHEP when available', async () => {
  global.fetch = async (url) => {
    if (url === '/hwcapture/features') {
      return { ok: true, json: async () => ({ webrtc: true }) };
    }
    return { ok: true, json: async () => ({ sdp: 'ans' }) };
  };
  global.RTCPeerConnection = class {
    constructor() { this.ontrack = null; }
    async createOffer() { return { sdp: 'off' }; }
    async setLocalDescription() {}
    async setRemoteDescription() { if (this.ontrack) this.ontrack({ track: 't' }); }
    close() {}
  };
  global.RTCSessionDescription = class { constructor(init){ this.type=init.type; this.sdp=init.sdp; } };
  const video = { src: '', srcObject: null };
  const mode = await initLivePreview(video);
  assert.strictEqual(mode, 'whep');
  assert.ok(video.srcObject instanceof FakeStream);
}));

// Test fallback path to demo clip
reset();

(test('initLivePreview falls back to demo clip', async () => {
  global.fetch = async (url, opts) => {
    if (url === '/hwcapture/features') {
      return { ok: true, json: async () => ({ webrtc: false }) };
    }
    // HLS head request fails
    return { ok: false };
  };
  const video = { src: '', srcObject: null };
  const mode = await initLivePreview(video);
  assert.strictEqual(mode, 'demo');
  assert.strictEqual(video.src, '/demo/bars720p30.mp4');
}));
