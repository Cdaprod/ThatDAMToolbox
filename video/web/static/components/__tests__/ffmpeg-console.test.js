// DOM tests for FFMpegConsole loadAssets and run
// Example: node --test ffmpeg-console.test.js
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';

// stub minimal document before loading script
global.document = { addEventListener: () => {} };

const code = fs.readFileSync(new URL('../ffmpeg-console.js', import.meta.url), 'utf8');
vm.runInThisContext(code + '\n;globalThis.FFMpegConsole = FFMpegConsole;');
const FFMpegConsole = global.FFMpegConsole;

function setupDom(){
  const make = () => ({ innerHTML:'', appendChild(){}, addEventListener(){}, style:{} });
  const elements = {
    'ff-quick-select': { innerHTML:'', appendChild(){}, addEventListener(){} },
    'ff-file-input': { files: [], addEventListener(){} },
    'ff-asset-select': { innerHTML:'', appendChild(opt){ this.innerHTML += `<option value="${opt.value}">${opt.textContent}</option>`; }, addEventListener(){} },
    'ff-output-name': make(),
    'ff-input': { value:'', addEventListener(){} },
    'ff-run': make(),
    'ff-history-list': { innerHTML:'' },
    'ff-output': { textContent:'', style:{} },
    'ff-clear-file': make()
  };
  global.document = {
    getElementById: id => elements[id],
    addEventListener: () => {},
    createElement: tag => ({ value:'', textContent:'', appendChild(){}, setAttribute(){}, style:{}, label:'' })
  };
  return elements;
}

test('loadAssets populates dropdown on success', async () => {
  const els = setupDom();
  global.fetch = async (url) => {
    if (url.startsWith('/api/v1/ffmpeg/history')) return { ok:true, json: async () => [] };
    return { ok:true, json: async () => ([{path:'a.mp4'}]) };
  };
  const fc = new FFMpegConsole({});
  await fc.init();
  await fc.loadAssets('');
  assert.match(els['ff-asset-select'].innerHTML, /a.mp4/);
});

test('loadAssets shows none on failure', async () => {
  const els = setupDom();
  global.fetch = async () => { throw new Error('net'); };
  const fc = new FFMpegConsole({});
  await fc.init();
  await fc.loadAssets('');
  assert.match(els['ff-asset-select'].innerHTML, /\(none\)/);
});

test('run posts command and shows output', async () => {
  const els = setupDom();
  global.fetch = async (url, opts) => {
    if (url.startsWith('/api/v1/ffmpeg/history')) return { ok:true, json: async () => [] };
    if (url === '/api/v1/ffmpeg/run') return { ok:true, json: async () => ({ exit:0, elapsed:1, stdout:'ok' }) };
    return { ok:true, json: async () => [] };
  };
  const fc = new FFMpegConsole({});
  await fc.init();
  els['ff-input'].value = 'ffmpeg -h';
  await fc.run();
  assert.match(els['ff-output'].textContent, /exit=0/);
});

test('run reports HTTP errors', async () => {
  const els = setupDom();
  global.fetch = async (url) => {
    if (url.startsWith('/api/v1/ffmpeg/history')) return { ok:true, json: async () => [] };
    if (url === '/api/v1/ffmpeg/run') return { ok:false, status:500 };
    return { ok:true, json: async () => [] };
  };
  const fc = new FFMpegConsole({});
  await fc.init();
  els['ff-input'].value = 'ffmpeg -h';
  await fc.run();
  assert.match(els['ff-output'].textContent, /HTTP 500/);
});
