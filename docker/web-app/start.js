const { spawn }          = require('child_process');
const { publishServiceUp } = require('./src/lib/serviceUp.js');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

// Attempt to connect to a locally running React DevTools instance during
// development.  `connectToDevTools` is a no-op if the DevTools server is not
// running, so this block can safely fail.
if (mode === 'dev') {
  try {
    // react-devtools-core expects a `self` global when required in Node.
    global.self = global;
    const { connectToDevTools } = require('react-devtools-core');
    connectToDevTools({
      host: 'localhost',
      port: Number(process.env.NEXT_PUBLIC_REACT_DEVTOOLS_PORT ?? 8097),
    });
  } catch (err) {
    console.warn('react-devtools-core failed to connect:', err.message);
  }
}

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