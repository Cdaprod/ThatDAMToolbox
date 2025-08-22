/**
 * Optionally connect to a running React DevTools instance.
 *
 * Example:
 *   maybeConnectReactDevTools('dev')
 */
function maybeConnectReactDevTools(mode) {
  if (
    mode !== 'dev' ||
    process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS === '0' ||
    typeof globalThis.window === 'undefined'
  ) {
    return
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectToDevTools } = require('react-devtools-core')
    connectToDevTools({
      host: 'localhost',
      port: Number(process.env.NEXT_PUBLIC_REACT_DEVTOOLS_PORT ?? 8097),
    })
  } catch (err) {
    console.warn('react-devtools-core failed to connect:', err.message)
  }
}

module.exports = { maybeConnectReactDevTools }
