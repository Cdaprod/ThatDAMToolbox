// Usage: node start.js [dev|start]
// Example: node start.js dev
const fs = require('fs');
const { spawn } = require('child_process');

let maybeConnectReactDevTools = () => {};
try {
  const mod = require('./src/lib/reactDevtools.js');
  maybeConnectReactDevTools =
    mod.maybeConnectReactDevTools ||
    mod.maybeConnectReactDevtools || // tolerate old casing once
    (() => {});
} catch (_) {}

const { publishServiceUp, requireMq } = require('./src/lib/serviceUp.js');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

async function main() {
  maybeConnectReactDevTools(mode);

  if (process.env.DEV_SKIP_MQ !== '1') {
    try {
      await requireMq();
    } catch (err) {
      console.error('[start] MQ connect failed:', err.message);
      if (process.env.NODE_ENV === 'production') process.exit(1);
    }
  }

  const standalone = '.next/standalone/server.js';
  const haveStandalone = fs.existsSync(standalone);

  // dev now binds 0.0.0.0 so external devices load chunks & HMR properly
  const devArgs = ['dev', '-p', '3000', '-H', '0.0.0.0'];
  const startArgs = ['start', '-p', '3000'];

  const child = mode === 'start'
    ? (haveStandalone
        ? spawn('node', [standalone], { stdio: ['ignore', 'pipe', 'pipe'] })
        : spawn('next', startArgs, { stdio: ['ignore', 'pipe', 'pipe'] }))
    : spawn('next', devArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

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
}

if (require.main === module) {
  main();
}

module.exports = { main };
