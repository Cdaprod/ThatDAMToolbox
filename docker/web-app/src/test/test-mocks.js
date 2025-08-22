/**
 * Runtime mocks for optional frontend modules in tests.
 *
 * Usage:
 *   node --require ./src/test/test-mocks.js --test <files>
 */
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === '@mui/material') {
    const React = require('react');
    return new Proxy({}, {
      get: () => (props) => React.createElement(React.Fragment, null, props && props.children)
    });
  }
  if (id === 'next-auth/react') {
    return { signIn: async () => {} };
  }
  if (id === 'react-devtools-core') {
    return { connectToDevTools: () => ({}) };
  }
  return originalRequire.call(this, id);
};
