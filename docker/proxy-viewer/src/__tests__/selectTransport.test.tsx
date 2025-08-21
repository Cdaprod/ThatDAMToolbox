import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTransport } from '@thatdamtoolbox/stream-registry';

test('selectTransport honors mode', () => {
  const entry = { id: 'cam1', hls: 'hls', webrtc: 'webrtc' };
  assert.equal(selectTransport(entry, 'director'), 'hls');
  assert.equal(selectTransport(entry, 'focus-pull'), 'webrtc');
});
