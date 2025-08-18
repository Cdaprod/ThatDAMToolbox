import test from 'node:test';
import assert from 'node:assert/strict';
import { tryPlay } from './index.js';

class MockVideo {
  src = '';
  played: string[] = [];
  play() { this.played.push(this.src); return Promise.resolve(); }
  pause() { return; }
  removeAttribute(_s: string) { this.src = ''; }
  canPlayType() { return 'maybe'; }
}

test('tryPlay falls through on failure', async () => {
  const el = new MockVideo() as unknown as HTMLVideoElement;
  const order: string[] = [];
  const funcs = [
    async (_el: HTMLVideoElement, _src: string) => { order.push('a'); throw new Error('a'); },
    async (_el: HTMLVideoElement, _src: string) => { order.push('b'); }
  ];
  await tryPlay(el, 'x', funcs);
  assert.deepEqual(order, ['a', 'b']);
});
