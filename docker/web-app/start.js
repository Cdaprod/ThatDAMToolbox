// Usage: node start.js [dev|start]
const fs = require('fs');
const { spawn } = require('child_process');

// Robust import that tolerates naming drift (DevTools vs Devtools)
let maybeConnectReactDevTools = () => {};
try {
  const devtoolsMod = require('./src/lib/reactDevtools.js');
  maybeConnectReactDevTools =
    devtoolsMod.maybeConnectReactDevTools ||
    devtoolsMod.maybeConnectReactDevtools || // tolerate legacy casing
    (() => {});
} catch (_) {
  // no-op: devtools optional in prod
}

const { publishServiceUp } = require('./src/lib/serviceUp.js');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
maybeConnectReactDevTools(mode);

const standalone = '.next/standalone/server.js';
const haveStandalone = fs.existsSync(standalone);

const child = mode === 'start'
  ? (haveStandalone
      ? spawn('node', [standalone], { stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('next', ['start', '-p', '3000'], { stdio: ['ignore', 'pipe', 'pipe'] }))
  : spawn('next', ['dev', '-p', '3000'], { stdio: ['ignore', 'pipe', 'pipe'] });

let sent = false;
child.stdout.on('data', async (data) => {
  const text = data.toString();
  process.stdout.write(text);
  if (!sent && /started server|ready/i.test(text)) {
    sent = true;
    try { await publishServiceUp(); } catch (_) {}
  }
});
child.stderr.on('data', (d) => process.stderr.write(d));
child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => { console.error(err); process.exit(1); });