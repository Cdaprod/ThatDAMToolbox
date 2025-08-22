declare module 'react-devtools-core';

declare module 'react-devtools-core/standalone' {
  interface DevToolsStandalone {
    setContentDOMNode(node: HTMLElement): DevToolsStandalone
    startServer(port?: number): void
  }
  const DevTools: DevToolsStandalone
  export = DevTools
}
