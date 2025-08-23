/**
 * Runtime mocks for optional frontend modules in tests.
 *
 * Usage:
 *   NODE_ENV=test node --require ./src/test/test-mocks.js --test <files>
 */
if (process.env.NODE_ENV === 'test') {
  const Module = require('module');
  const path = require('path');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.startsWith('@/')) {
      const target = path.join(process.cwd(), '.tmp-test', id.slice(2));
      return originalRequire.call(this, target);
    }
    if (id === '@mui/material') {
      const React = require('react');
      return new Proxy({}, {
        get: () => (props) => React.createElement(React.Fragment, null, props && props.children)
      });
    }
    if (id === 'next-auth/react') {
      return { signIn: async () => {} };
    }
    if (id === 'next-auth') {
      return { getServerSession: async () => null };
    }
    if (id === 'next-auth/providers/google') {
      return () => ({ id: 'google' });
    }
    if (id === 'react-devtools-core') {
      return { connectToDevTools: () => ({}), startServer: () => {} };
    }
    return originalRequire.call(this, id);
  };
}
