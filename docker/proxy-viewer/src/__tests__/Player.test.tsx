import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { render, h } from 'preact';

// Example: npm test

test('Player mounts and cleans up', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  // @ts-ignore expose globals for preact
  global.window = dom.window;
  // @ts-ignore
  global.document = dom.window.document;
  let cleaned = false;
  const { default: Player } = await import('../components/Player.tsx');
  const root = dom.window.document.getElementById('root') as HTMLElement;
  render(h(Player, { source: 's', create: () => () => { cleaned = true; } }), root);
  render(null, root);
  assert.ok(cleaned, 'cleanup should run');
});
