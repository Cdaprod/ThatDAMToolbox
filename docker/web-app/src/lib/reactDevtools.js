/**
 * Optionally start the React DevTools server in dev mode.
 *
 * Example:
 *   maybeConnectReactDevTools('dev')
 */
function maybeConnectReactDevTools(mode) {
  if (mode !== 'dev') return;
  try {
    // react-devtools-core expects a global `self` when required in Node
    // eslint-disable-next-line no-global-assign
    global.self = global;
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const { startServer } = require('react-devtools-core');
    startServer();
    console.log('[devtools] React DevTools server started');
  } catch (e) {
    console.warn('[devtools] failed to start React DevTools:', e.message);
  }
}

module.exports = { maybeConnectReactDevTools };
