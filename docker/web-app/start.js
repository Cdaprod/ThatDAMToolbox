/**
 * Spawn Next.js dev or production server and publish a `service.up` event.
 *
 * Usage: node start.js [dev|start]
 * Example: node start.js dev
 */
const fs = require('fs');
const { spawn } = require('child_process');
const { publishServiceUp } = require('./src/lib/serviceUp.js');
const { maybeConnectReactDevtools } = require('./src/lib/reactDevtools.js');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
maybeConnectReactDevtools(mode);

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
