// Tests for UploadCard refresh event
// Example: node --test upload-card.test.js
import test from 'node:test';
import assert from 'node:assert';

// stub minimal DOM for UploadCard
const inputEl = { addEventListener: () => {} };
const listEl = { appendChild: () => {} };
const cardEl = {
  querySelector: (sel) => (sel === '#file-input' ? inputEl : listEl)
};

global.document = {
  getElementById: () => cardEl,
  addEventListener: () => {},
  createElement: () => ({ textContent: '' })
};

global.window = {
  dispatchEvent: (evt) => events.push(evt),
  addEventListener: () => {}
};

const events = [];

// stub timer and network
let clearCalled = false;

global.fetch = async () => ({
  ok: true,
  json: async () => ({ filename: 'f', progress: 1, status: 'done' })
});

global.Event = class { constructor(type){ this.type = type; } };

const UploadCard = (await import('../upload-card.js')).default;

test('poll dispatches explorer refresh event', async () => {
  // wrap setInterval to run callback immediately and wait for completion
  const done = new Promise(resolve => {
    global.setInterval = (fn, t) => { fn().then(resolve); return 0; };
  });
  global.clearInterval = () => { clearCalled = true; };

  const uc = new UploadCard();
  const li = { textContent: '' };
  uc.poll('123', li);
  await done;
  assert.strictEqual(clearCalled, true);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'explorer:refresh');
});
