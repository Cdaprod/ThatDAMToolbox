// Node tests for dam-client list helpers
// Example: node --test dam-client.test.js
import test from 'node:test';
import assert from 'node:assert';
import { listFolders, listAssets } from '../dam-client.js';

test('listFolders throws on HTTP error', async () => {
  global.fetch = async () => ({ ok: false, text: async () => 'boom' });
  await assert.rejects(() => listFolders(), /boom/);
});

test('listAssets throws on HTTP error', async () => {
  global.fetch = async () => ({ ok: false, text: async () => 'bad' });
  await assert.rejects(() => listAssets('/'), /bad/);
});
