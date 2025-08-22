// start.js - spawn Next.js dev or production server
// Usage: node start.js [dev|start]
// Example: NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS=1 node start.js dev
const { spawn }          = require('child_process');
const { publishServiceUp } = require('./src/lib/serviceUp.js');
const { maybeConnectReactDevTools } = require('./src/lib/reactDevtools.js');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

// Attempt to connect to React DevTools only when running in a browser context.
maybeConnectReactDevTools(mode);

const child = mode === 'start'
  ? spawn('node', ['.next/standalone/server.js'], { stdio: ['ignore', 'pipe', 'pipe'] })
  : spawn('next', ['dev'], { stdio: ['ignore', 'pipe', 'pipe'] });

let sent = false;
child.stdout.on('data', async (data) => {
  const text = data.toString();
  process.stdout.write(text);
  if (!sent && text.toLowerCase().includes('started server')) {
    sent = true;
    await publishServiceUp();
  }
});
child.stderr.on('data', (data) => process.stderr.write(data));
child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
