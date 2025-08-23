/**
 * Optional React DevTools integration for Next.js (web).
 *
 * Defaults to NO-OP. If you want a desktop DevTools window:
 *   1) On your dev machine (outside Docker), run:
 *        npx react-devtools --port 8097
 *   2) Set env in the web app:
 *        REACT_DEVTOOLS_HOST=host.docker.internal
 *        REACT_DEVTOOLS_PORT=8097
 *   3) Start the app; we'll call connectToDevTools() if available.
 */
function maybeConnectReactDevTools(mode) {
  if (mode !== 'dev') return;

  const host = process.env.REACT_DEVTOOLS_HOST;
  const port = Number(process.env.REACT_DEVTOOLS_PORT || 0);

  // If not explicitly configured, just give a helpful hint and return.
  if (!host || !port) {
    console.log('[devtools] Tip: run `npx react-devtools --port 8097` on your dev machine, then set REACT_DEVTOOLS_HOST/PORT to auto-connect.');
    return;
  }

  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const core = require('react-devtools-core');

    if (typeof core.connectToDevTools === 'function') {
      core.connectToDevTools({ host, port });
      console.log(`[devtools] Connected to React DevTools at ${host}:${port}`);
    } else {
      console.warn('[devtools] react-devtools-core.connectToDevTools not found; falling back to no-op.');
    }
  } catch (e) {
    console.warn('[devtools] failed to connect to React DevTools:', e.message);
  }
}

module.exports = { maybeConnectReactDevTools };